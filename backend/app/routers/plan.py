from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.plan import Block, ImportBody, Template
from app.services import plan as svc

router = APIRouter(prefix="/api", tags=["plan"])


# Depends(get_db): FastAPI calls get_db() for each request and passes the session in.
@router.get("/plan")
def get_plan(db: Session = Depends(get_db)) -> dict:
    """The whole plan, in the same shape as the old plan.json."""
    return svc.plan_json(db)


@router.get("/progress")
def get_progress(db: Session = Depends(get_db)) -> dict[str, bool]:
    """All ticks, in the same shape as the old progress.json: {"<tick id>": true/false}."""
    return svc.progress_json(db)


@router.post("/import")
def import_plan(body: ImportBody, dry_run: bool = False, db: Session = Depends(get_db)) -> dict:
    """Same format as the Import panel. With ?dry_run=true it only returns the preview.
    One transaction: if anything is refused, nothing is saved."""
    summary = svc.apply_import(db, body)
    if dry_run:
        db.rollback()
    else:
        db.commit()
    return {"dryRun": dry_run, "summary": summary}


@router.get("/routine")
def get_routine(db: Session = Depends(get_db)) -> dict:
    return svc.routine_json(db)


@router.put("/routine/{template}")
def put_routine(template: Template, blocks: list[Block], db: Session = Depends(get_db)) -> dict:
    """Replaces one whole template (weekday, saturday or sunday)."""
    svc.replace_routine(db, template, blocks)
    db.commit()
    return svc.routine_json(db)
