"""SQLAlchemy models: one Python class per database table.

Alembic compares these classes with the real database to write migrations.
Every rule that matters is also a database constraint (CHECK, UNIQUE, FOREIGN KEY),
so bad data is refused even if a bug in the Python code lets it through.
"""

import datetime as dt

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    MetaData,
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

TASK_TYPES = ("learn", "practise", "project", "review", "french", "personal")
ROUTINE_TEMPLATES = ("weekday", "saturday", "sunday")
ROUTINE_KINDS = ("wake", "coding", "french", "work", "meal", "rest", "fun", "sleep")


def one_of(column: str, values: tuple[str, ...]) -> str:
    """SQL for a CHECK like: type IN ('learn', 'practise', ...)."""
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def not_blank(column: str) -> str:
    return f"length(trim({column})) > 0"


class Base(DeclarativeBase):
    # Predictable constraint names (ck_tasks_type, fk_weeks_month_id_months, ...),
    # so later migrations can find and change them by name.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


# Mapped[int] = NOT NULL column, Mapped[int | None] = column that allows NULL.
# String(n) becomes varchar(n): PostgreSQL refuses longer text.


class PlanMeta(Base):
    __tablename__ = "plan_meta"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row"),
        CheckConstraint("start_date < target_end", name="start_before_end"),
        CheckConstraint("target_months > 0", name="target_months_positive"),
    )

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    title: Mapped[str | None] = mapped_column(String(200))
    start_date: Mapped[dt.date | None] = mapped_column(Date)
    target_end: Mapped[dt.date | None] = mapped_column(Date)
    target_months: Mapped[int | None] = mapped_column(SmallInteger)


class Month(Base):
    __tablename__ = "months"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="end_after_start"),
        CheckConstraint(not_blank("title"), name="title_not_blank"),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # "m1", same as plan.json
    title: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date] = mapped_column(Date)
    position: Mapped[int]

    # relationship: month.weeks gives this month's Week objects (no SQL to write).
    # cascade: deleting a month in Python also deletes its weeks.
    weeks: Mapped[list["Week"]] = relationship(
        back_populates="month", order_by="Week.start_date", cascade="all, delete-orphan"
    )


class Week(Base):
    __tablename__ = "weeks"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="end_after_start"),
        CheckConstraint(not_blank("title"), name="title_not_blank"),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # "m1-w1"
    # ondelete=CASCADE: PostgreSQL itself deletes the weeks when their month is deleted.
    month_id: Mapped[str] = mapped_column(ForeignKey("months.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    goal: Mapped[str] = mapped_column(String(2000), default="", server_default="")
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date] = mapped_column(Date)

    month: Mapped[Month] = relationship(back_populates="weeks")
    days: Mapped[list["Day"]] = relationship(
        back_populates="week", order_by="Day.date", cascade="all, delete-orphan"
    )


class Day(Base):
    __tablename__ = "days"
    # One day per date. DEFERRED: checked at COMMIT, not after each row, so a
    # reschedule can move many days in one transaction even when, halfway through,
    # two of them briefly share a date.
    __table_args__ = (UniqueConstraint("date", deferrable=True, initially="DEFERRED"),)

    id: Mapped[int] = mapped_column(primary_key=True)  # integer primary key = auto-numbered
    week_id: Mapped[str] = mapped_column(ForeignKey("weeks.id", ondelete="CASCADE"), index=True)
    date: Mapped[dt.date] = mapped_column(Date)
    focus: Mapped[str] = mapped_column(String(200), default="", server_default="")

    week: Mapped[Week] = relationship(back_populates="days")
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="day", order_by="Task.position", cascade="all, delete-orphan"
    )


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(one_of("type", TASK_TYPES), name="type"),
        CheckConstraint(not_blank("text"), name="text_not_blank"),
        # Either both times (a timeline slot) or neither (free text like "Work hour").
        CheckConstraint("(start_time IS NULL) = (end_time IS NULL)", name="times_together"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("days.id", ondelete="CASCADE"), index=True)
    # The old plan.json id ("2026-11-18-learn", "custom-..."). Ticks used to be saved
    # under it, so it never changes, even when the task moves to another date.
    legacy_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    type: Mapped[str] = mapped_column(String(20))
    time_label: Mapped[str | None] = mapped_column(String(50))  # as written: "7:00-8:30", "Work hour"
    start_time: Mapped[dt.time | None] = mapped_column(Time)  # parsed from time_label when it's a range
    end_time: Mapped[dt.time | None] = mapped_column(Time)
    text: Mapped[str] = mapped_column(String(1000))
    resources: Mapped[str | None] = mapped_column(String(1000))
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    position: Mapped[int]
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    day: Mapped[Day] = relationship(back_populates="tasks")
    tick: Mapped["TaskTick | None"] = relationship(cascade="all, delete-orphan")


class TaskTick(Base):
    __tablename__ = "task_ticks"

    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    done: Mapped[bool] = mapped_column(Boolean)
    done_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))  # empty for imported ticks


class RoutineBlock(Base):
    __tablename__ = "routine_blocks"
    __table_args__ = (
        UniqueConstraint("template", "block_key"),
        CheckConstraint(one_of("template", ROUTINE_TEMPLATES), name="template"),
        CheckConstraint(one_of("kind", ROUTINE_KINDS), name="kind"),
        CheckConstraint(f"task_type IS NULL OR {one_of('task_type', TASK_TYPES)}", name="task_type"),
        CheckConstraint("block_key ~ '^[a-z0-9-]+$'", name="block_key_format"),
        CheckConstraint("end_time IS NULL OR end_time > start_time", name="end_after_start"),
        CheckConstraint(not_blank("label"), name="label_not_blank"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    template: Mapped[str] = mapped_column(String(20))
    block_key: Mapped[str] = mapped_column(String(50))  # the plan.json block id, e.g. "french-evening"
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time | None] = mapped_column(Time)  # empty for one-moment blocks (wake up, sleep)
    label: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(20))
    task_type: Mapped[str | None] = mapped_column(String(20))
    tickable: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    position: Mapped[int]


class RoutineTick(Base):
    __tablename__ = "routine_ticks"

    # Two-column primary key: one row per (date, block), which also makes the pair unique.
    date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    block_key: Mapped[str] = mapped_column(String(50), primary_key=True)
    done: Mapped[bool] = mapped_column(Boolean)
    done_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))


class TickEvent(Base):
    """History: one row for every tick and untick, never updated or deleted."""

    __tablename__ = "tick_events"
    __table_args__ = (
        CheckConstraint("kind IN ('task', 'routine')", name="kind"),
        CheckConstraint("action IN ('tick', 'untick')", name="action"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    ref: Mapped[str] = mapped_column(String(150))  # task id, or "<date>/<block_key>" for routine
    action: Mapped[str] = mapped_column(String(10))
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (CheckConstraint("mood BETWEEN 1 AND 5", name="mood_range"),)

    date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    learned: Mapped[str] = mapped_column(String(5000), default="", server_default="")
    struggled: Mapped[str] = mapped_column(String(5000), default="", server_default="")
    notes: Mapped[str] = mapped_column(String(5000), default="", server_default="")
    mood: Mapped[int | None] = mapped_column(SmallInteger)  # 1-5, or empty
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ScheduleShift(Base):
    """One "Reschedule": days from from_date on moved by `days`. `changes` keeps every
    old value (day dates and weeks, week and month ranges, weeks and months it created),
    so the last shift can be undone exactly."""

    __tablename__ = "schedule_shifts"
    __table_args__ = (CheckConstraint("days > 0", name="days_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    from_date: Mapped[dt.date] = mapped_column(Date)
    days: Mapped[int] = mapped_column(SmallInteger)
    changes: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    undone_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
