from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.plan import ShiftIn
from app.services import reschedule as svc

router = APIRouter(prefix="/api/reschedule", tags=["reschedule"])


def shift_json(s) -> dict | None:
    if s is None:
        return None
    return {"id": s.id, "fromDate": s.from_date.isoformat(), "days": s.days,
            "createdAt": s.created_at.isoformat(), "undone": s.undone_at is not None}  # fmt: skip


@router.post("")
def shift(body: ShiftIn, dry_run: bool = False, db: Session = Depends(get_db)) -> dict:
    """Moves every unfinished day from fromDate on, so fromDate lands on newStart.
    ?dry_run=true returns the preview (old and new dates, warnings) and saves nothing."""
    preview = svc.shift(db, body.fromDate, body.newStart)
    if dry_run:
        db.rollback()
        preview["shiftId"] = None
    else:
        db.commit()
    return {"dryRun": dry_run, **preview}


@router.get("/last")
def last(db: Session = Depends(get_db)) -> dict | None:
    """The most recent shift (to offer "Undo"), or null."""
    return shift_json(svc.last_shift(db))


@router.post("/undo")
def undo(db: Session = Depends(get_db)) -> dict:
    """Undoes the most recent shift (only that one, and only once)."""
    undone = svc.undo_last(db)
    db.commit()
    return shift_json(undone)
