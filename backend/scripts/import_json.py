"""Copies frontend/data/plan.json and progress.json into the database.

Run from backend/:
    .\\.venv\\Scripts\\python.exe -m scripts.import_json --dry-run   # show what would happen, write nothing
    .\\.venv\\Scripts\\python.exe -m scripts.import_json             # import for real

- Safe to run again: rows are matched (months/weeks by id, days by date, tasks by
  legacy_id, routine blocks by template + block id, ticks by task or date + block)
  and updated, never duplicated. Nothing in the database is ever deleted.
- One transaction: if anything fails, nothing is written.
- Afterwards every item from the JSON files must be found in the database, or the
  whole import is rolled back.
- Runs as plan_app (data rights only), like the app itself.
"""

import argparse
import json
import shutil
import sys
from collections import Counter, defaultdict
from datetime import date, time

from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.db.session import SessionLocal
from app.models.tables import Day, Month, PlanMeta, RoutineBlock, RoutineTick, Task, TaskTick, Week
from app.services.plan import ROUTINE_TICK, parse_range
from app.services.time import kathmandu_today

DATA_DIR = BACKEND_DIR.parent / "frontend" / "data"



def to_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def to_time(value: str | None) -> time | None:
    return time.fromisoformat(value) if value else None


def upsert(db: Session, model, key: dict, fields: dict, stats: Counter):
    """Finds the row matching `key` and updates it, or creates it. Counts what happened."""
    row = db.scalars(select(model).filter_by(**key)).one_or_none()
    if row is None:
        row = model(**key, **fields)
        db.add(row)
        db.flush()  # sends the INSERT now (still inside the transaction), so row.id is known
        stats["created"] += 1
    elif any(getattr(row, name) != value for name, value in fields.items()):
        for name, value in fields.items():
            setattr(row, name, value)
        stats["updated"] += 1
    else:
        stats["unchanged"] += 1
    return row


def import_data(db: Session, plan: dict, progress: dict) -> tuple[dict, list[str]]:
    """Writes everything into the session (not committed). Returns (stats per table, skipped tick ids)."""
    stats: dict[str, Counter] = defaultdict(Counter)

    if meta := plan.get("meta"):
        upsert(db, PlanMeta, {"id": 1}, {
            "title": meta.get("title"),
            "start_date": to_date(meta.get("start")),
            "target_end": to_date(meta.get("targetEnd")),
            "target_months": meta.get("targetMonths"),
        }, stats["plan_meta"])

    task_db_ids = {}  # "2026-11-18-learn" -> database id
    for month_pos, m in enumerate(plan["months"]):
        upsert(db, Month, {"id": m["id"]}, {
            "title": m["title"],
            "start_date": to_date(m["start"]),
            "end_date": to_date(m["end"]),
            "position": month_pos,
        }, stats["months"])

        for w in m.get("weeks", []):
            upsert(db, Week, {"id": w["id"]}, {
                "month_id": m["id"],
                "title": w["title"],
                "goal": w.get("goal") or "",
                "start_date": to_date(w["start"]),
                "end_date": to_date(w["end"]),
            }, stats["weeks"])

            for d in w.get("days", []):
                day = upsert(db, Day, {"date": to_date(d["date"])}, {
                    "week_id": w["id"],
                    "focus": d.get("focus") or "",
                }, stats["days"])

                for task_pos, t in enumerate(d.get("tasks", [])):
                    start, end = parse_range(t.get("time"))
                    task = upsert(db, Task, {"legacy_id": t["id"]}, {
                        "day_id": day.id,
                        "type": t["type"],
                        "time_label": t.get("time") or None,
                        "start_time": start,
                        "end_time": end,
                        "text": t["text"],
                        "resources": t.get("resources") or None,
                        "is_custom": t["id"].startswith("custom-"),
                        "position": task_pos,
                    }, stats["tasks"])
                    task_db_ids[t["id"]] = task.id

    for template, blocks in (plan.get("routine") or {}).items():
        for pos, b in enumerate(blocks):
            upsert(db, RoutineBlock, {"template": template, "block_key": b["id"]}, {
                "start_time": to_time(b["start"]),
                "end_time": to_time(b.get("end")),
                "label": b["label"],
                "kind": b["kind"],
                "task_type": b.get("taskType"),
                "tickable": bool(b.get("tickable", False)),
                "position": pos,
            }, stats["routine_blocks"])

    # done_at stays empty: progress.json doesn't say when a tick happened.
    skipped = []
    for tick_id, done in progress.items():
        if match := ROUTINE_TICK.match(tick_id):
            key = {"date": to_date(match[1]), "block_key": match[2]}
            upsert(db, RoutineTick, key, {"done": done}, stats["routine_ticks"])
        elif tick_id in task_db_ids:
            upsert(db, TaskTick, {"task_id": task_db_ids[tick_id]}, {"done": done}, stats["task_ticks"])
        else:
            skipped.append(tick_id)  # a tick for a task that no longer exists in plan.json

    db.flush()
    return stats, skipped


def expected_counts(plan: dict, progress: dict, skipped: list[str]) -> dict[str, int]:
    weeks = [w for m in plan["months"] for w in m.get("weeks", [])]
    days = [d for w in weeks for d in w.get("days", [])]
    routine_ticks = [k for k in progress if ROUTINE_TICK.match(k)]
    return {
        "plan_meta": 1 if plan.get("meta") else 0,
        "months": len(plan["months"]),
        "weeks": len(weeks),
        "days": len(days),
        "tasks": sum(len(d.get("tasks", [])) for d in days),
        "routine_blocks": sum(len(b) for b in (plan.get("routine") or {}).values()),
        "task_ticks": len(progress) - len(routine_ticks) - len(skipped),
        "routine_ticks": len(routine_ticks),
    }


def found_counts(db: Session, plan: dict, progress: dict) -> dict[str, int]:
    """Counts the rows in the database that match an item of the JSON files."""
    weeks = [w for m in plan["months"] for w in m.get("weeks", [])]
    days = [d for w in weeks for d in w.get("days", [])]
    task_ids = [t["id"] for d in days for t in d.get("tasks", [])]
    blocks = [(tpl, b["id"]) for tpl, bl in (plan.get("routine") or {}).items() for b in bl]
    routine_keys = [(to_date(m[1]), m[2]) for k in progress if (m := ROUTINE_TICK.match(k))]

    def count(stmt) -> int:
        return db.scalar(select(func.count()).select_from(stmt.subquery()))

    return {
        "plan_meta": db.scalar(select(func.count()).select_from(PlanMeta)) if plan.get("meta") else 0,
        "months": count(select(Month.id).where(Month.id.in_([m["id"] for m in plan["months"]]))),
        "weeks": count(select(Week.id).where(Week.id.in_([w["id"] for w in weeks]))),
        "days": count(select(Day.id).where(Day.date.in_([to_date(d["date"]) for d in days]))),
        "tasks": count(select(Task.id).where(Task.legacy_id.in_(task_ids))),
        "routine_blocks": count(
            select(RoutineBlock.id).where(tuple_(RoutineBlock.template, RoutineBlock.block_key).in_(blocks))
        ) if blocks else 0,
        "task_ticks": count(
            select(TaskTick.task_id).join(Task).where(Task.legacy_id.in_([k for k in progress if k in task_ids]))
        ),
        "routine_ticks": count(
            select(RoutineTick.date).where(tuple_(RoutineTick.date, RoutineTick.block_key).in_(routine_keys))
        ) if routine_keys else 0,
    }


def print_report(stats, expected, found, skipped) -> None:
    print(f"{'table':<16}{'in JSON':>9}{'in DB':>8}{'created':>9}{'updated':>9}{'unchanged':>11}")
    for name, want in expected.items():
        s = stats[name]
        print(f"{name:<16}{want:>9}{found[name]:>8}{s['created']:>9}{s['updated']:>9}{s['unchanged']:>11}")
    if skipped:
        print(f"Skipped {len(skipped)} tick(s) for tasks that are not in plan.json: {', '.join(skipped)}")


def archive_json() -> None:
    """Keeps a dated copy of both files in frontend/data/archive/."""
    today = kathmandu_today().isoformat()
    archive = DATA_DIR / "archive"
    archive.mkdir(exist_ok=True)
    for name in ("plan", "progress"):
        source = DATA_DIR / f"{name}.json"
        if source.exists():
            shutil.copy2(source, archive / f"{name}-{today}.json")
    print(f"Copied plan.json and progress.json to {archive} (dated {today}).")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import plan.json and progress.json into PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="show what would be imported, write nothing")
    args = parser.parse_args()

    plan = json.loads((DATA_DIR / "plan.json").read_text(encoding="utf-8"))
    progress_file = DATA_DIR / "progress.json"
    progress = json.loads(progress_file.read_text(encoding="utf-8")) if progress_file.exists() else {}

    # SessionLocal starts one transaction: everything below is saved by commit() or
    # thrown away by rollback() together.
    with SessionLocal() as db:
        try:
            stats, skipped = import_data(db, plan, progress)
            expected = expected_counts(plan, progress, skipped)
            found = found_counts(db, plan, progress)
        except Exception as exc:
            db.rollback()
            print(f"Import failed, nothing was written: {type(exc).__name__}: {exc}", file=sys.stderr)
            return 1

        print_report(stats, expected, found, skipped)
        if found != expected:
            db.rollback()
            print("Counts don't match the JSON files. Rolled back, nothing was written.", file=sys.stderr)
            return 1

        if args.dry_run:
            db.rollback()
            print("Dry run: counts match. Nothing was written.")
            return 0

        db.commit()
    print("Imported. Counts match.")
    archive_json()
    return 0


if __name__ == "__main__":
    sys.exit(main())
