"""Plan logic shared by the routers: the backend version of the frontend's
planEdit.js, planImport.js and the cross-item checks of validatePlan.js.

Functions change rows in the session but never commit; the router commits once at
the end, so a request is all-or-nothing. A change that isn't allowed raises
HTTPException(400) with a readable message, and the router's session rolls back.
"""

import random
import re
import string
from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.tables import (
    Day,
    Month,
    PlanMeta,
    RoutineBlock,
    RoutineTick,
    Task,
    TaskTick,
    TickEvent,
    Week,
)
from app.schemas.plan import Block, ImportBody

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]  # fmt: skip
TIME_RANGE = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")  # "7:00-8:30"
ROUTINE_TICK = re.compile(r"^routine-(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)$")  # "routine-2026-11-18-wake"


def refuse(*problems: str, status: int = 400):
    raise HTTPException(status, "\n".join(problems))


def parse_range(label: str | None) -> tuple[time | None, time | None]:
    """'7:00-8:30' -> (07:00, 08:30). Free text like 'Work hour' -> (None, None)."""
    match = TIME_RANGE.match(label or "")
    if not match:
        return None, None
    h1, m1, h2, m2 = map(int, match.groups())
    if h1 > 23 or h2 > 23 or m1 > 59 or m2 > 59:
        return None, None
    return time(h1, m1), time(h2, m2)


def hhmm(t: time | None) -> str | None:
    return t.strftime("%H:%M") if t else None


def now() -> datetime:
    return datetime.now(timezone.utc)


# --- Reading: the same shapes as plan.json and progress.json ---


def task_json(t: Task) -> dict:
    return {"id": t.legacy_id, "type": t.type, "time": t.time_label or "", "text": t.text,
            "resources": t.resources or ""}  # fmt: skip


def block_json(b: RoutineBlock) -> dict:
    block = {"id": b.block_key, "start": hhmm(b.start_time)}
    if b.end_time:
        block["end"] = hhmm(b.end_time)
    block.update(label=b.label, kind=b.kind)
    if b.task_type:
        block["taskType"] = b.task_type
    block["tickable"] = b.tickable
    return block


def routine_json(db: Session) -> dict:
    routine = {"weekday": [], "saturday": [], "sunday": []}
    for b in db.scalars(select(RoutineBlock).order_by(RoutineBlock.template, RoutineBlock.position)):
        routine[b.template].append(block_json(b))
    return routine


def plan_json(db: Session) -> dict:
    # selectinload: fetch all weeks, days and tasks in a few queries up front,
    # instead of one query per month, per week and per day.
    months = db.scalars(
        select(Month)
        .order_by(Month.start_date)
        .options(selectinload(Month.weeks).selectinload(Week.days).selectinload(Day.tasks))
    ).all()
    plan: dict = {}
    if meta := db.get(PlanMeta, 1):
        values = {"title": meta.title, "start": meta.start_date and meta.start_date.isoformat(),
                  "targetEnd": meta.target_end and meta.target_end.isoformat(), "targetMonths": meta.target_months}  # fmt: skip
        plan["meta"] = {k: v for k, v in values.items() if v is not None}
    plan["months"] = [
        {"id": m.id, "title": m.title, "start": m.start_date.isoformat(), "end": m.end_date.isoformat(),
         "weeks": [
             {"id": w.id, "title": w.title, "start": w.start_date.isoformat(), "end": w.end_date.isoformat(),
              "goal": w.goal,
              "days": [{"date": d.date.isoformat(), "focus": d.focus, "tasks": [task_json(t) for t in d.tasks]}
                       for d in w.days]}
             for w in m.weeks]}
        for m in months
    ]  # fmt: skip
    plan["routine"] = routine_json(db)
    return plan


def progress_json(db: Session) -> dict[str, bool]:
    ticks = {legacy_id: done for legacy_id, done in db.execute(select(Task.legacy_id, TaskTick.done).join(TaskTick))}
    for r in db.scalars(select(RoutineTick)):
        ticks[f"routine-{r.date.isoformat()}-{r.block_key}"] = r.done
    return ticks


# --- Checks across items (the parts of validatePlan.js a single row can't check) ---


def check_plan(db: Session) -> None:
    db.flush()  # send pending changes first, so the queries below see them
    problems = []

    def overlaps(rows, name):
        rows = sorted(rows, key=lambda r: r.start_date)
        for a, b in zip(rows, rows[1:]):
            if b.start_date <= a.end_date:
                problems.append(f'{name} "{a.title}" and "{b.title}" overlap')

    overlaps(db.scalars(select(Month)).all(), "Months")
    overlaps(db.scalars(select(Week)).all(), "Weeks")

    outside = db.execute(
        select(Day.date, Week.title, Week.start_date, Week.end_date)
        .join(Week)
        .where((Day.date < Week.start_date) | (Day.date > Week.end_date))
    )
    for day, title, start, end in outside:
        problems.append(f'Day {day} is outside its week "{title}" ({start} to {end})')

    blocks = db.scalars(select(RoutineBlock)).all()
    for template in ("weekday", "saturday", "sunday"):
        ranges = [(b.start_time, b.end_time or b.start_time, b.block_key) for b in blocks if b.template == template]
        for i, (s1, e1, k1) in enumerate(ranges):
            for s2, e2, k2 in ranges[i + 1:]:
                if s1 < e2 and s2 < e1:  # touching (08:30 end, 08:30 start) is fine
                    problems.append(f'Routine "{template}": blocks "{k1}" and "{k2}" overlap')

    if problems:
        refuse(*problems)


# --- Finding or creating months, weeks and days (like ensureMonth / ensureDay) ---


def count(db: Session, stmt) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery()))


def clamp_range(start: date, end: date, d: date, ranges) -> tuple[date, date]:
    """Shrinks start..end so it doesn't overlap the (start, end) ranges around d."""
    for r_start, r_end in ranges:
        if r_end < d and r_end >= start:
            start = r_end + timedelta(days=1)
        if r_start > d and r_start <= end:
            end = r_start - timedelta(days=1)
    return start, end


def new_month_id(db: Session) -> str:
    n = count(db, select(Month.id)) + 1
    while db.get(Month, f"m{n}"):
        n += 1
    return f"m{n}"


def new_week_id(db: Session, month: Month) -> str:
    n = count(db, select(Week.id).where(Week.month_id == month.id)) + 1
    while db.get(Week, f"{month.id}-w{n}"):
        n += 1
    return f"{month.id}-w{n}"


def ensure_month(db: Session, d: date) -> Month:
    """The month containing d, or a new calendar month ("January 2027") trimmed to fit."""
    if month := db.scalars(select(Month).where(Month.start_date <= d, Month.end_date >= d)).first():
        return month
    first = d.replace(day=1)
    last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    others = db.execute(select(Month.start_date, Month.end_date)).all()
    start, end = clamp_range(first, last, d, others)
    month = Month(id=new_month_id(db), title=f"{MONTH_NAMES[d.month - 1]} {d.year}",
                  start_date=start, end_date=end, position=len(others))  # fmt: skip
    db.add(month)
    db.flush()
    return month


def ensure_week(db: Session, d: date) -> Week:
    """The week containing d, or a new one (Monday to Sunday, trimmed to fit) in its month."""
    week = db.scalars(select(Week).where(Week.start_date <= d, Week.end_date >= d)).first()
    if week is None:
        monday = d - timedelta(days=d.weekday())
        others = db.execute(select(Week.start_date, Week.end_date)).all()
        start, end = clamp_range(monday, monday + timedelta(days=6), d, others)
        month = ensure_month(db, d)
        week = Week(id=new_week_id(db, month), month_id=month.id, title=f"Week {len(others) + 1}",
                    start_date=start, end_date=end, goal="")  # fmt: skip
        db.add(week)
        db.flush()
    return week


def ensure_day(db: Session, d: date) -> Day:
    """The day for d, creating it, its week and its month if needed."""
    week = ensure_week(db, d)
    day = db.scalars(select(Day).where(Day.date == d)).first()
    if day is None:
        day = Day(week_id=week.id, date=d, focus="")
        db.add(day)
        db.flush()
    return day


# --- Tasks ---


def get_task(db: Session, task_id: str) -> Task:
    task = db.scalars(select(Task).where(Task.legacy_id == task_id)).first()
    if task is None:
        refuse(f'Task "{task_id}" not found', status=404)
    return task


def next_position(db: Session, day: Day) -> int:
    return (db.scalar(select(func.max(Task.position)).where(Task.day_id == day.id)) or 0) + 1


def set_time(task: Task, label: str) -> None:
    task.time_label = label or None
    task.start_time, task.end_time = parse_range(label)


def new_custom_id(db: Session, d: date) -> str:
    """custom-<date>-<4 random letters>, e.g. custom-2026-11-20-kqzt."""
    while True:
        task_id = f"custom-{d.isoformat()}-{''.join(random.choices(string.ascii_lowercase, k=4))}"
        if not db.scalars(select(Task.id).where(Task.legacy_id == task_id)).first():
            return task_id


def add_task(db: Session, task_id: str, d: date, type_: str, time_label: str, text: str,
             resources: str) -> Task:  # fmt: skip
    day = ensure_day(db, d)
    task = Task(legacy_id=task_id, day_id=day.id, type=type_, text=text, resources=resources or None,
                is_custom=task_id.startswith("custom-"), position=next_position(db, day))  # fmt: skip
    set_time(task, time_label)
    db.add(task)
    db.flush()
    return task


def move_task(db: Session, task: Task, d: date) -> None:
    """Moves a task to another day. It keeps its id, so its tick stays with it."""
    day = ensure_day(db, d)
    if day.id != task.day_id:
        task.day_id = day.id
        task.position = next_position(db, day)


# --- Ticks ---


def set_task_tick(db: Session, task: Task, done: bool) -> bool:
    """Returns True if the tick changed. Every change is also written to tick_events."""
    tick = db.get(TaskTick, task.id)
    if (tick.done if tick else False) == done:
        return False
    if tick is None:
        tick = TaskTick(task_id=task.id)
        db.add(tick)
    tick.done, tick.done_at = done, now() if done else None
    db.add(TickEvent(kind="task", ref=task.legacy_id, action="tick" if done else "untick"))
    return True


def set_routine_tick(db: Session, d: date, block_key: str, done: bool) -> bool:
    tick = db.get(RoutineTick, (d, block_key))
    if (tick.done if tick else False) == done:
        return False
    if tick is None:
        tick = RoutineTick(date=d, block_key=block_key)
        db.add(tick)
    tick.done, tick.done_at = done, now() if done else None
    db.add(TickEvent(kind="routine", ref=f"{d.isoformat()}/{block_key}", action="tick" if done else "untick"))
    return True


def set_ticks(db: Session, ticks: dict[str, bool]) -> int:
    """Many ticks at once (Mark day done, Untick week, Reset, Undo). All ids must exist."""
    task_ids = [k for k in ticks if not k.startswith("routine-")]
    tasks = {t.legacy_id: t for t in db.scalars(select(Task).where(Task.legacy_id.in_(task_ids)))}
    unknown = [k for k in task_ids if k not in tasks]
    routine = {}
    for k in ticks:
        if k.startswith("routine-"):
            match = ROUTINE_TICK.match(k)
            try:
                routine[k] = (date.fromisoformat(match[1]), match[2])
            except (TypeError, ValueError):  # no match, or a date like 2026-02-30
                unknown.append(k)
    if unknown:
        refuse(f"Unknown tick id(s): {', '.join(unknown[:10])}", status=404)
    changed = sum(set_task_tick(db, tasks[k], ticks[k]) for k in task_ids)
    changed += sum(set_routine_tick(db, d, key, ticks[k]) for k, (d, key) in routine.items())
    return changed


# --- Months and weeks ---


def get_month(db: Session, month_id: str) -> Month:
    return db.get(Month, month_id) or refuse(f'Month "{month_id}" not found', status=404)


def get_week(db: Session, week_id: str) -> Week:
    return db.get(Week, week_id) or refuse(f'Week "{week_id}" not found', status=404)


def update_month(db: Session, month: Month, title: str, start: date, end: date) -> None:
    """Refused if any of its weeks would end up outside the new dates."""
    outside = [w for w in month.weeks if w.start_date < start or w.end_date > end]
    if outside:
        names = ", ".join(f'"{w.title}" ({w.start_date} to {w.end_date})' for w in outside)
        refuse(f"{names} would end up outside the month. Delete or shorten it first.")
    month.title, month.start_date, month.end_date = title, start, end
    check_plan(db)


def add_week(db: Session, month: Month) -> Week:
    """An empty week after the month's last week (to that Sunday), stretching the month if needed."""
    last_end = db.scalar(select(func.max(Week.end_date)).where(Week.month_id == month.id))
    start = last_end + timedelta(days=1) if last_end else month.start_date
    end = start - timedelta(days=start.weekday()) + timedelta(days=6)
    number = count(db, select(Week.id).where(Week.start_date < start)) + 1
    week = Week(id=new_week_id(db, month), month_id=month.id, title=f"Week {number}: New week",
                start_date=start, end_date=end, goal="")  # fmt: skip
    db.add(week)
    month.end_date = max(month.end_date, end)
    check_plan(db)
    return week


def delete_counts(db: Session, week_ids: list[str]) -> dict:
    """How many tasks and ticked tasks deleting these weeks removes (for the confirmation)."""
    tasks = select(Task.id).join(Day).where(Day.week_id.in_(week_ids))
    ticks = select(TaskTick.task_id).where(TaskTick.task_id.in_(tasks), TaskTick.done.is_(True))
    return {"tasks": count(db, tasks), "ticks": count(db, ticks)}


# --- Routine ---


def slug(text: str) -> str:
    """'Coding: learn' -> 'coding-learn'."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "block"


def replace_routine(db: Session, template: str, blocks: list[Block]) -> None:
    """Replaces a whole template. Blocks without an id keep the id of the matching
    current block (same label, or same start and kind), so their ticks stay."""
    current = db.scalars(select(RoutineBlock).where(RoutineBlock.template == template)).all()
    rows = []
    for pos, b in enumerate(blocks):
        start, end = time.fromisoformat(b.start), b.end and time.fromisoformat(b.end)
        match = next((c for c in current if c.label == b.label), None) or next(
            (c for c in current if c.start_time == start and c.kind == b.kind), None
        )
        key = b.id or (match and match.block_key) or slug(b.label)
        rows.append(RoutineBlock(template=template, block_key=key, start_time=start, end_time=end, label=b.label,
                                 kind=b.kind, task_type=b.taskType, tickable=b.tickable, position=pos))  # fmt: skip
    keys = [r.block_key for r in rows]
    if dupes := sorted({k for k in keys if keys.count(k) > 1}):
        refuse(f'Routine "{template}": duplicate block id(s) {", ".join(dupes)}')
    for c in current:
        db.delete(c)
    db.flush()  # delete first, or the new rows would clash with the unique (template, block_key)
    db.add_all(rows)
    check_plan(db)


# --- Import (like planImport.js importIntoPlan) ---


def apply_import(db: Session, body: ImportBody) -> dict:
    summary = {"tasks": [], "newWeeks": [], "updatedWeeks": [], "routine": []}
    problems = []

    # 1. Weeks first, so tasks on those dates land in them.
    for w in body.weeks:
        existing = db.scalars(select(Week).where(Week.start_date == w.start)).first()
        if existing:
            existing.title = w.title
            if w.goal is not None:
                existing.goal = w.goal
            summary["updatedWeeks"].append(w.title)
            continue
        if w.monthTitle:
            month = db.scalars(select(Month).where(Month.title == w.monthTitle)).first()
        else:
            month = db.scalars(select(Month).where(Month.start_date <= w.start, Month.end_date >= w.start)).first()
        if month is None:
            month = Month(id=new_month_id(db), title=w.monthTitle or f"Month {count(db, select(Month.id)) + 1}",
                          start_date=w.start, end_date=w.end, position=count(db, select(Month.id)))  # fmt: skip
            db.add(month)
        month.start_date, month.end_date = min(month.start_date, w.start), max(month.end_date, w.end)
        db.flush()
        db.add(Week(id=new_week_id(db, month), month_id=month.id, title=w.title, start_date=w.start,
                    end_date=w.end, goal=w.goal or ""))  # fmt: skip
        db.flush()
        summary["newWeeks"].append(w.title)

    # 2. Tasks. Existing ids are never changed or reused.
    used = set(db.scalars(select(Task.legacy_id)))
    for i, t in enumerate(body.tasks, 1):
        if t.id is not None and t.id in used:
            problems.append(f'Task {i} ("{t.text}"): id "{t.id}" already exists')
            continue
        task_id = t.id
        if task_id is None:
            task_id, n = f"{t.date.isoformat()}-{t.type}", 2
            while task_id in used:
                task_id, n = f"{t.date.isoformat()}-{t.type}-{n}", n + 1
        used.add(task_id)
        add_task(db, task_id, t.date, t.type, t.time, t.text, t.resources)
        summary["tasks"].append({"id": task_id, "date": t.date.isoformat(), "type": t.type, "time": t.time,
                                 "text": t.text, "resources": t.resources})  # fmt: skip

    # 3. Day focus (the month wizard), for days that exist.
    for d in body.days:
        if d.focus and (day := db.scalars(select(Day).where(Day.date == d.date)).first()):
            day.focus = d.focus

    if problems:
        refuse(*problems)

    # 4. Routine templates replace the current ones.
    for template, blocks in body.routine.items():
        replace_routine(db, template, blocks)
        summary["routine"].append(template)

    check_plan(db)
    summary["tasks"].sort(key=lambda t: t["date"])
    return summary
