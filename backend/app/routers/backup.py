"""Export everything as JSON, and import such a backup again (Build Plan 4, Phase 10).

The full safety net is pg_dump (scripts/backup.ps1). This JSON export is the
readable copy: the plan, the ticks and the journal, in the same shapes as
GET /api/plan and /api/progress.
"""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import StrictBool, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import DataError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.tables import JournalEntry
from app.routers.journal import journal_json
from app.schemas.plan import JournalIn, Strict
from app.services.plan import check_plan, plan_json, progress_json, refuse
from app.services.time import kathmandu_today
from scripts.import_json import import_data

router = APIRouter(prefix="/api", tags=["backup"])

BACKUP_VERSION = 1


class Backup(Strict):
    """The outer shape is checked here; the plan inside is checked while importing
    (missing fields, database rules, overlaps), and the journal entry by entry."""

    version: int
    exportedOn: str | None = None
    plan: dict[str, Any]
    progress: dict[str, StrictBool] = {}
    journal: list[dict[str, Any]] = []


@router.get("/export")
def export(db: Session = Depends(get_db)) -> dict:
    entries = db.scalars(select(JournalEntry).order_by(JournalEntry.date)).all()
    return {
        "version": BACKUP_VERSION,
        "exportedOn": kathmandu_today().isoformat(),
        "plan": plan_json(db),
        "progress": progress_json(db),
        "journal": [journal_json(e.date, e) for e in entries],
    }


@router.post("/restore")
def restore(body: Backup, db: Session = Depends(get_db)) -> dict:
    """Merges a backup into the database: items are matched by id (tasks), date (days,
    journal) or template + block id, then created or updated. Nothing is deleted.
    One transaction: if anything is wrong, nothing is saved."""
    if body.version != BACKUP_VERSION:
        refuse(f"Unknown backup version {body.version}")
    try:
        _, skipped = import_data(db, body.plan, body.progress)
        for raw in body.journal:
            day = date.fromisoformat(raw["date"])
            fields = JournalIn(**{k: raw.get(k) for k in ("learned", "struggled", "notes") if raw.get(k) is not None},
                               mood=raw.get("mood"))
            entry = db.get(JournalEntry, day) or JournalEntry(date=day)
            entry.learned, entry.struggled, entry.notes, entry.mood = fields.learned, fields.struggled, fields.notes, fields.mood
            db.add(entry)
        check_plan(db)  # overlapping weeks/months, days outside their week, routine overlaps
    except (KeyError, TypeError, ValueError, AttributeError, ValidationError, DataError):
        # ValidationError is a ValueError too; listed for clarity. Details stay out of the reply.
        db.rollback()
        refuse("That file isn't a valid Plan Tracker backup")
    db.commit()
    return {"restored": True, "skippedTicks": len(skipped), "journal": len(body.journal)}
