"""Pydantic schemas: the exact shape every request body must have.

FastAPI checks each body against its schema BEFORE the endpoint runs; anything
wrong (missing field, wrong type, unknown key, too long, bad date) is refused
with 422 and a list of what's wrong. So the endpoints only ever see clean data.
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StringConstraints, model_validator

TaskType = Literal["learn", "practise", "project", "review", "french", "personal"]
Template = Literal["weekday", "saturday", "sunday"]
Kind = Literal["wake", "coding", "french", "work", "meal", "rest", "fun", "sleep"]

# Annotated[type, rules]: the type plus extra checks. strip_whitespace trims the text first.
PlanDate = Annotated[date, Field(ge=date(2000, 1, 1), le=date(2100, 12, 31))]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Goal = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Focus = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
TaskText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
Resources = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
TimeLabel = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]  # "07:00-08:30" or "Work hour"
TaskId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9-]{1,100}$")]
TickId = Annotated[str, StringConstraints(min_length=1, max_length=150)]
HHMM = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
BlockKey = Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{1,50}$")]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class Strict(BaseModel):
    # extra="forbid": unknown keys are an error, not silently ignored (catches typos).
    model_config = ConfigDict(extra="forbid")


class DateRange(Strict):
    start: PlanDate
    end: PlanDate

    @model_validator(mode="after")
    def start_not_after_end(self):
        if self.start > self.end:
            raise ValueError("start must be on or before end")
        return self


# --- Ticks ---


class TickUpdate(Strict):
    done: StrictBool  # only true/false; "yes" or 1 are refused


class BulkTicks(Strict):
    """{"ticks": {"2026-11-18-learn": true, "routine-2026-11-18-wake": false}}"""

    ticks: dict[TickId, StrictBool] = Field(max_length=5000)


# --- Tasks ---


class TaskCreate(Strict):
    date: PlanDate
    type: TaskType
    time: TimeLabel = ""
    text: TaskText
    resources: Resources = ""


class TaskUpdate(Strict):
    """Only the fields sent are changed. A new date moves the task (it keeps its id)."""

    date: PlanDate | None = None
    type: TaskType | None = None
    time: TimeLabel | None = None
    text: TaskText | None = None
    resources: Resources | None = None


# --- Months and weeks ---


class MonthIn(DateRange):
    title: Title


class WeekUpdate(Strict):
    title: Title
    goal: Goal = ""


# --- Routine ---


class Block(Strict):
    id: BlockKey | None = None  # left out: keeps the id of the matching current block
    start: HHMM
    end: HHMM | None = None  # left out for one-moment blocks (wake up, sleep)
    label: Label
    kind: Kind
    taskType: TaskType | None = None
    tickable: StrictBool = False

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end is not None and self.end <= self.start:  # "HH:MM" text compares correctly
            raise ValueError(f"block {self.label}: end must be after start")
        return self


# --- Import (same format as the app's Import panel; "days" is used by the month wizard) ---


class ImportWeek(DateRange):
    monthTitle: Title | None = None
    title: Title
    goal: Goal | None = None


class ImportTask(Strict):
    id: TaskId | None = None
    date: PlanDate
    type: TaskType
    time: TimeLabel = ""
    text: TaskText
    resources: Resources = ""


class ImportDay(Strict):
    date: PlanDate
    focus: Focus


class ImportBody(Strict):
    tasks: list[ImportTask] = Field(default=[], max_length=2000)
    weeks: list[ImportWeek] = Field(default=[], max_length=100)
    days: list[ImportDay] = Field(default=[], max_length=1000)
    routine: dict[Template, list[Block]] = {}


# --- Journal (Build Plan 4, Phase 7) ---

JournalText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class JournalIn(Strict):
    learned: JournalText = ""
    struggled: JournalText = ""
    notes: JournalText = ""
    mood: Annotated[int, Field(strict=True, ge=1, le=5)] | None = None  # 1-5, or null for none


# --- Reschedule (Phase 8) ---


class ShiftIn(Strict):
    fromDate: PlanDate  # usually the first unfinished day
    newStart: PlanDate  # where that day moves to; everything after moves by the same amount
