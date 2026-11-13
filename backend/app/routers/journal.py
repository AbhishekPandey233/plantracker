"""Look back: the daily journal and the history of past days (Build Plan 4, Phase 7)."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.tables import Day, JournalEntry, RoutineTick, Task, TaskTick
from app.schemas.plan import JournalIn, PlanDate
from app.services.plan import refuse
from app.services.time import kathmandu_today

router = APIRouter(prefix="/api", tags=["journal and history"])

MAX_HISTORY_DAYS = 400


def journal_json(day: date, entry: JournalEntry | None) -> dict:
    """Always the same shape, so the form can show an empty entry too."""
    return {
        "date": day.isoformat(),
        "exists": entry is not None,
        "learned": entry.learned if entry else "",
        "struggled": entry.struggled if entry else "",
        "notes": entry.notes if entry else "",
        "mood": entry.mood if entry else None,
        "updatedAt": entry.updated_at.isoformat() if entry else None,
    }


@router.get("/journal/{day}")
def get_journal(day: date, db: Session = Depends(get_db)) -> dict:
    return journal_json(day, db.get(JournalEntry, day))


@router.put("/journal/{day}")
def put_journal(day: date, body: JournalIn, db: Session = Depends(get_db)) -> dict:
    """Saves the entry for a day. An entry with nothing in it is deleted instead,
    so "has journal" only means days where something was written."""
    entry = db.get(JournalEntry, day)
    empty = not (body.learned or body.struggled or body.notes) and body.mood is None
    if empty:
        if entry:
            db.delete(entry)
        db.commit()
        return journal_json(day, None)
    if entry is None:
        entry = JournalEntry(date=day)
        db.add(entry)
    entry.learned, entry.struggled, entry.notes, entry.mood = body.learned, body.struggled, body.notes, body.mood
    db.commit()
    db.refresh(entry)  # reload updated_at, which the database set
    return journal_json(day, entry)


def status_of(day: date, today: date, done: int, total: int) -> str:
    """Same rules as dayStatus() in the frontend's planHelpers.js."""
    if total == 0:
        return "empty"
    if done == total:
        return "complete"
    if day > today:
        return "upcoming"
    if done > 0:
        return "partial"
    return "today" if day == today else "missed"


def escape_like(text: str) -> str:
    """In ILIKE, % and _ are wildcards; escape them so a search for "50%" finds "50%"."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("/history")
def history(
    to: PlanDate | None = None,
    from_: PlanDate | None = Query(None, alias="from"),
    today: PlanDate | None = None,
    q: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Every day from `from` to `to` (default: the last 400 days up to today), newest first:
    its status, tasks done and not done, ticked routine blocks and journal.
    Days without plan tasks are included only when they have a journal entry.
    `q` searches the journal text (PostgreSQL ILIKE, sent as a parameter, never pasted into SQL).
    `today` lets the app's ?now= test mode decide which days count as missed."""
    today = today or kathmandu_today()
    to = to or today
    from_ = from_ or to - timedelta(days=MAX_HISTORY_DAYS - 1)
    if from_ > to:
        refuse('"from" must be on or before "to"')
    if (to - from_).days >= MAX_HISTORY_DAYS:
        refuse(f"At most {MAX_HISTORY_DAYS} days at a time")

    journal_query = select(JournalEntry).where(JournalEntry.date.between(from_, to))
    if q and q.strip():
        pattern = f"%{escape_like(q.strip())}%"
        fields = (JournalEntry.learned, JournalEntry.struggled, JournalEntry.notes)
        journal_query = journal_query.where(or_(*(f.ilike(pattern, escape="\\") for f in fields)))
    journals = {j.date: j for j in db.scalars(journal_query)}

    days_query = select(Day).where(Day.date.between(from_, to)).options(selectinload(Day.tasks).selectinload(Task.tick))
    if q and q.strip():
        days_query = days_query.where(Day.date.in_(list(journals)))  # searching: only days whose journal matches
    days = {d.date: d for d in db.scalars(days_query)}

    routine = {}
    for tick in db.scalars(select(RoutineTick).where(RoutineTick.date.between(from_, to), RoutineTick.done.is_(True))):
        routine.setdefault(tick.date, []).append(tick.block_key)

    result = []
    for d in sorted(set(journals) | {d for d, day in days.items() if day.tasks}, reverse=True):
        day = days.get(d)
        tasks = [{"id": t.legacy_id, "type": t.type, "text": t.text, "done": bool(t.tick and t.tick.done)}
                 for t in (day.tasks if day else [])]  # fmt: skip
        done = sum(t["done"] for t in tasks)
        entry = journals.get(d)
        result.append({
            "date": d.isoformat(),
            "focus": day.focus if day else "",
            "status": status_of(d, today, done, len(tasks)),
            "done": done,
            "total": len(tasks),
            "tasks": tasks,
            "routineTicked": sorted(routine.get(d, [])),
            "hasJournal": entry is not None,
            "learned": entry.learned.split("\n", 1)[0] if entry else "",  # first line, for the list
            "mood": entry.mood if entry else None,
        })
    return result
