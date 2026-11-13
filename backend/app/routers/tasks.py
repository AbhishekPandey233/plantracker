from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.plan import TaskCreate, TaskUpdate
from app.services import plan as svc

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("", status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)) -> dict:
    """Adds one of my own tasks ("mine"). Its day, week and month are created if needed."""
    task = svc.add_task(db, svc.new_custom_id(db, body.date), body.date, body.type, body.time, body.text,
                        body.resources)  # fmt: skip
    svc.check_plan(db)
    db.commit()
    return {"id": task.legacy_id}


@router.patch("/{task_id}")
def update_task(task_id: str, body: TaskUpdate, db: Session = Depends(get_db)) -> dict:
    """Changes only the fields sent. A new date moves the task; its id and tick stay."""
    task = svc.get_task(db, task_id)
    if body.type is not None:
        task.type = body.type
    if body.text is not None:
        task.text = body.text
    if body.resources is not None:
        task.resources = body.resources or None
    if body.time is not None:
        svc.set_time(task, body.time)
    if body.date is not None:
        svc.move_task(db, task, body.date)
    svc.check_plan(db)
    db.commit()
    return {"id": task.legacy_id}


@router.delete("/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)) -> dict:
    """Only my own tasks can be deleted; plan tasks stay (move them instead)."""
    task = svc.get_task(db, task_id)
    if not task.is_custom:
        svc.refuse("Only your own tasks can be deleted.")
    db.delete(task)
    db.commit()
    return {"deleted": task_id}
