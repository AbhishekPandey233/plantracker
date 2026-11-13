from datetime import date

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.plan import BulkTicks, TickUpdate
from app.services import plan as svc

router = APIRouter(prefix="/api/ticks", tags=["ticks"])


@router.put("/tasks/{task_id}")
def tick_task(task_id: str, body: TickUpdate, db: Session = Depends(get_db)) -> dict:
    """Ticks or unticks one plan task, by its plan id (e.g. 2026-11-18-learn)."""
    changed = svc.set_task_tick(db, svc.get_task(db, task_id), body.done)
    db.commit()
    return {"changed": int(changed)}


@router.put("/routine/{day}/{block_key}")
def tick_routine(
    day: date,
    body: TickUpdate,
    block_key: str = Path(pattern=r"^[a-z0-9-]{1,50}$"),
    db: Session = Depends(get_db),
) -> dict:
    changed = svc.set_routine_tick(db, day, block_key, body.done)
    db.commit()
    return {"changed": int(changed)}


@router.put("")
def tick_many(body: BulkTicks, db: Session = Depends(get_db)) -> dict:
    """Many ticks at once: Mark day done, Untick week, Reset and Undo.
    All or nothing: one unknown id and nothing changes."""
    changed = svc.set_ticks(db, body.ticks)
    db.commit()
    return {"changed": changed}
