import json
from datetime import date, time

from sqlalchemy import select

from app.models.tables import RoutineTick, Task, TaskTick
from scripts.import_json import DATA_DIR, expected_counts, found_counts, import_data, parse_range

SMALL_PLAN = {
    "meta": {"title": "Test", "start": "2031-01-06", "targetEnd": "2031-06-01", "targetMonths": 5},
    "months": [{
        "id": "test-m1", "title": "Test month", "start": "2031-01-06", "end": "2031-01-12",
        "weeks": [{
            "id": "test-m1-w1", "title": "Test week", "start": "2031-01-06", "end": "2031-01-12", "goal": "g",
            "days": [{"date": "2031-01-06", "focus": "f", "tasks": [
                {"id": "2031-01-06-learn", "type": "learn", "time": "7:00-8:30", "text": "Learn", "resources": "MDN"},
                {"id": "custom-2031-01-06-abcd", "type": "personal", "time": "Work hour", "text": "Mine"},
            ]}],
        }],
    }],
    "routine": {"weekday": [{"id": "test-wake", "start": "06:00", "label": "Wake", "kind": "wake", "tickable": True}]},
}
SMALL_PROGRESS = {"2031-01-06-learn": True, "routine-2031-01-06-test-wake": True, "gone-task": True}


def test_parse_range():
    assert parse_range("7:00-8:30") == (time(7, 0), time(8, 30))
    assert parse_range("07:00 - 08:30") == (time(7, 0), time(8, 30))
    assert parse_range("Work hour") == (None, None)
    assert parse_range("") == (None, None)
    assert parse_range(None) == (None, None)


def test_small_plan_imports_and_maps_fields(db):
    stats, skipped = import_data(db, SMALL_PLAN, SMALL_PROGRESS)
    assert skipped == ["gone-task"]
    assert found_counts(db, SMALL_PLAN, SMALL_PROGRESS) == expected_counts(SMALL_PLAN, SMALL_PROGRESS, skipped)

    learn = db.scalars(select(Task).where(Task.legacy_id == "2031-01-06-learn")).one()
    assert (learn.start_time, learn.end_time, learn.is_custom, learn.day.date) == (time(7), time(8, 30), False, date(2031, 1, 6))
    mine = db.scalars(select(Task).where(Task.legacy_id == "custom-2031-01-06-abcd")).one()
    assert (mine.time_label, mine.start_time, mine.is_custom, mine.resources) == ("Work hour", None, True, None)

    assert db.get(TaskTick, learn.id).done is True
    assert db.get(RoutineTick, (date(2031, 1, 6), "test-wake")).done is True


def test_running_twice_changes_nothing(db):
    import_data(db, SMALL_PLAN, SMALL_PROGRESS)
    stats, _ = import_data(db, SMALL_PLAN, SMALL_PROGRESS)
    for table, counter in stats.items():
        assert counter["created"] == 0 and counter["updated"] == 0, table


def test_changed_json_updates_instead_of_duplicating(db):
    import_data(db, SMALL_PLAN, SMALL_PROGRESS)
    changed = json.loads(json.dumps(SMALL_PLAN))
    changed["months"][0]["weeks"][0]["days"][0]["tasks"][0]["text"] = "Learn more"
    stats, _ = import_data(db, changed, SMALL_PROGRESS)
    assert stats["tasks"]["updated"] == 1 and stats["tasks"]["created"] == 0
    assert len(db.scalars(select(Task).where(Task.legacy_id == "2031-01-06-learn")).all()) == 1


def test_api_returns_exactly_the_old_json_files(client, db):
    """The compatibility promise: after importing, GET /api/plan and /api/progress give back
    the same JSON as plan.json and progress.json (Phase 6 switches the frontend over)."""
    plan = json.loads((DATA_DIR / "plan.json").read_text(encoding="utf-8"))
    progress = json.loads((DATA_DIR / "progress.json").read_text(encoding="utf-8"))
    import_data(db, plan, progress)
    # Every item from the files comes back unchanged. The live database may hold more
    # (tasks and ticks added in the app since), so compare items, not the whole answer.
    api_plan = client.get("/api/plan").json()

    def tasks(p):
        return {t["id"]: t for m in p["months"] for w in m["weeks"] for d in w["days"] for t in d["tasks"]}

    assert tasks(plan).items() <= tasks(api_plan).items()
    assert plan["routine"] == api_plan["routine"] and plan.get("meta") == api_plan.get("meta")
    assert progress.items() <= client.get("/api/progress").json().items()


def test_real_json_files_import_with_matching_counts(db):
    plan = json.loads((DATA_DIR / "plan.json").read_text(encoding="utf-8"))
    progress = json.loads((DATA_DIR / "progress.json").read_text(encoding="utf-8"))
    _, skipped = import_data(db, plan, progress)
    assert found_counts(db, plan, progress) == expected_counts(plan, progress, skipped)
