from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.tables import Month
from app.schemas.plan import MonthIn, WeekUpdate
from app.services import plan as svc

router = APIRouter(prefix="/api", tags=["months and weeks"])


@router.post("/months", status_code=201)
def create_month(body: MonthIn, db: Session = Depends(get_db)) -> dict:
    """An empty month. Refused if it overlaps another month."""
    position = db.scalar(select(func.count()).select_from(Month))
    month = Month(id=svc.new_month_id(db), title=body.title, start_date=body.start, end_date=body.end,
                  position=position)  # fmt: skip
    db.add(month)
    svc.check_plan(db)
    db.commit()
    return {"id": month.id}


@router.patch("/months/{month_id}")
def update_month(month_id: str, body: MonthIn, db: Session = Depends(get_db)) -> dict:
    """New title and dates. Refused if a week would end up outside them, or months would overlap."""
    svc.update_month(db, svc.get_month(db, month_id), body.title, body.start, body.end)
    db.commit()
    return {"id": month_id}


@router.delete("/months/{month_id}")
def delete_month(month_id: str, dry_run: bool = False, db: Session = Depends(get_db)) -> dict:
    """Deletes the month with its weeks, days, tasks and their ticks.
    ?dry_run=true only returns the counts, for the confirmation message."""
    month = svc.get_month(db, month_id)
    counts = svc.delete_counts(db, [w.id for w in month.weeks])
    if not dry_run:
        db.delete(month)
        db.commit()
    return {"dryRun": dry_run, **counts}


@router.post("/months/{month_id}/weeks", status_code=201)
def add_week(month_id: str, db: Session = Depends(get_db)) -> dict:
    """An empty week after the month's last week, stretching the month if needed."""
    week = svc.add_week(db, svc.get_month(db, month_id))
    db.commit()
    return {"id": week.id}


@router.patch("/weeks/{week_id}")
def update_week(week_id: str, body: WeekUpdate, db: Session = Depends(get_db)) -> dict:
    """New title and goal (the dates and id stay)."""
    week = svc.get_week(db, week_id)
    week.title, week.goal = body.title, body.goal
    db.commit()
    return {"id": week_id}


@router.delete("/weeks/{week_id}")
def delete_week(week_id: str, dry_run: bool = False, db: Session = Depends(get_db)) -> dict:
    week = svc.get_week(db, week_id)
    counts = svc.delete_counts(db, [week.id])
    if not dry_run:
        db.delete(week)
        db.commit()
    return {"dryRun": dry_run, **counts}
