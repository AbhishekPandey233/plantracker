"""Reschedule (Build Plan 4, Phase 8): move every unfinished day from a date onwards by
the same number of days, and undo the last such move.

How a shift works (all in one transaction):
- days on/after `from_date` move by `delta` days, except completed days (never moved),
- weeks and months that start on/after `from_date` move too; one that spans `from_date`
  gets longer instead, so its moved days still fit,
- a completed day left behind is put into whichever week now covers its date
  (a new week is made if none does, like adding a task does),
- every old value goes into a schedule_shifts row, so undo can put it all back.
"""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.tables import Day, Month, ScheduleShift, Task, Week
from app.services.plan import check_plan, ensure_week, now, refuse

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
# Abhishek's usual pattern: which weekdays each task type belongs on (Monday = 0).
USUAL_DAYS = {"learn": {0, 1, 2, 3, 4}, "practise": {0, 1, 2, 3, 4}, "project": {5}, "review": {6}}
MAX_SHIFT_DAYS = 366


def is_complete(day: Day) -> bool:
    return bool(day.tasks) and all(t.tick is not None and t.tick.done for t in day.tasks)


def is_usual(task_type: str, d: date) -> bool:
    return d.weekday() in USUAL_DAYS.get(task_type, set(range(7)))  # french/personal: any day


def shift(db: Session, from_date: date, new_start: date) -> dict:
    delta = (new_start - from_date).days
    if delta <= 0:
        refuse("The new start date must be after the from date.")
    if delta > MAX_SHIFT_DAYS:
        refuse(f"Shift by at most {MAX_SHIFT_DAYS} days.")
    step = timedelta(days=delta)

    days = db.scalars(
        select(Day).where(Day.date >= from_date).order_by(Day.date)
        .options(selectinload(Day.tasks).selectinload(Task.tick), selectinload(Day.week))
    ).all()  # fmt: skip
    moving = [d for d in days if not is_complete(d)]
    keeping = [d for d in days if is_complete(d)]
    if not moving:
        refuse(f"Nothing to move: every day from {from_date} on is already done.")
    kept_dates = {d.date for d in keeping}
    if clashes := sorted(str(d.date + step) for d in moving if d.date + step in kept_dates):
        refuse(f"These days are done and can't move, but other days would land on them: {', '.join(clashes)}. "
               "Pick a different new start date.")  # fmt: skip

    preview = {
        "days": delta,
        "wholeWeeks": delta % 7 == 0,
        "moved": [{"date": d.date.isoformat(), "newDate": (d.date + step).isoformat(), "focus": d.focus,
                   "tasks": len(d.tasks)} for d in moving],
        "kept": [d.date.isoformat() for d in keeping],
        # Tasks that were on a usual weekday for their type but won't be after the move.
        "unusual": [{"date": (d.date + step).isoformat(), "weekday": WEEKDAYS[(d.date + step).weekday()],
                     "type": t.type, "text": t.text}
                    for d in moving for t in d.tasks if is_usual(t.type, d.date) and not is_usual(t.type, d.date + step)],
    }  # fmt: skip

    changes = {"days": [], "weeks": [], "months": [], "createdWeeks": [], "createdMonths": []}
    for d in moving:
        changes["days"].append([d.id, d.date.isoformat(), d.week_id])
        d.date += step
    for model, key in ((Week, "weeks"), (Month, "months")):
        for row in db.scalars(select(model).where(model.end_date >= from_date)):
            changes[key].append([row.id, row.start_date.isoformat(), row.end_date.isoformat()])
            if row.start_date >= from_date:
                row.start_date += step
            row.end_date += step
    db.flush()

    # Completed days stay put; give each a week that covers its date.
    weeks_before = set(db.scalars(select(Week.id)))
    months_before = set(db.scalars(select(Month.id)))
    for d in keeping:
        db.refresh(d.week)
        if not (d.week.start_date <= d.date <= d.week.end_date):
            changes["days"].append([d.id, d.date.isoformat(), d.week_id])
            d.week_id = ensure_week(db, d.date).id
    changes["createdWeeks"] = sorted(set(db.scalars(select(Week.id))) - weeks_before)
    changes["createdMonths"] = sorted(set(db.scalars(select(Month.id))) - months_before)

    check_plan(db)
    record = ScheduleShift(from_date=from_date, days=delta, changes=changes)
    db.add(record)
    db.flush()
    return {**preview, "shiftId": record.id}


def last_shift(db: Session) -> ScheduleShift | None:
    return db.scalars(select(ScheduleShift).order_by(ScheduleShift.id.desc())).first()


def undo_last(db: Session) -> ScheduleShift:
    """Puts back everything the last shift changed. Refused if the plan has changed in a
    way that makes that impossible (e.g. tasks were added to a week the shift created)."""
    last = last_shift(db)
    if last is None or last.undone_at is not None:
        refuse("There is no shift to undo.", status=404)
    c = last.changes
    for day_id, old_date, old_week in c["days"]:
        if (day := db.get(Day, day_id)) is not None:  # skipped if deleted since
            if db.get(Week, old_week) is None:
                refuse(f"Can't undo: the week {old_week} that day {old_date} was in has been deleted.")
            day.date, day.week_id = date.fromisoformat(old_date), old_week
    for model, key in ((Week, "weeks"), (Month, "months")):
        for row_id, start, end in c[key]:
            if (row := db.get(model, row_id)) is not None:
                row.start_date, row.end_date = date.fromisoformat(start), date.fromisoformat(end)
    db.flush()
    for model, key, child in ((Week, "createdWeeks", "days"), (Month, "createdMonths", "weeks")):
        for row_id in c[key]:
            if (row := db.get(model, row_id)) is not None:
                db.refresh(row)
                if getattr(row, child):
                    refuse(f'Can\'t undo: "{row.title}" was made by the shift and has been used since.')
                db.delete(row)
    last.undone_at = now()
    check_plan(db)
    return last
