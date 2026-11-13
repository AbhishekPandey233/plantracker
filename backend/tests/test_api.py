"""Endpoint tests. Every test runs in a throw-away transaction (see conftest.py) and
uses dates in 2031, so it never touches or collides with the real plan."""

from sqlalchemy import select

from app.models.tables import TickEvent


def find_task(plan, task_id):
    for m in plan["months"]:
        for w in m["weeks"]:
            for d in w["days"]:
                for t in d["tasks"]:
                    if t["id"] == task_id:
                        return {**t, "date": d["date"], "week": w, "month": m}
    return None


def import_week(client, **extra):
    """A week of 2031 with two plan tasks."""
    body = {
        "weeks": [{"monthTitle": "Test month", "title": "Week T1", "start": "2031-03-03", "end": "2031-03-09",
                   "goal": "Testing"}],
        "tasks": [
            {"date": "2031-03-03", "type": "learn", "time": "07:00-08:30", "text": "Learn a thing", "resources": "MDN"},
            {"date": "2031-03-03", "type": "learn", "text": "Learn another thing"},
        ],
        **extra,
    }  # fmt: skip
    res = client.post("/api/import", json=body)
    assert res.status_code == 200, res.text
    return res.json()["summary"]


# --- Reading ---


def test_plan_and_progress_have_the_old_json_shapes(client):
    plan = client.get("/api/plan").json()
    assert set(plan) >= {"months", "routine"}
    assert set(plan["routine"]) == {"weekday", "saturday", "sunday"}
    assert isinstance(client.get("/api/progress").json(), dict)


# --- Import ---


def test_import_dry_run_saves_nothing(client):
    body = {"tasks": [{"date": "2031-03-04", "type": "learn", "text": "Preview only"}]}
    res = client.post("/api/import?dry_run=true", json=body)
    assert res.status_code == 200
    assert res.json()["summary"]["tasks"][0]["id"] == "2031-03-04-learn"
    assert find_task(client.get("/api/plan").json(), "2031-03-04-learn") is None


def test_import_creates_month_week_days_and_ids(client):
    summary = import_week(client, days=[{"date": "2031-03-03", "focus": "Focus day"}])
    assert [t["id"] for t in summary["tasks"]] == ["2031-03-03-learn", "2031-03-03-learn-2"]
    assert summary["newWeeks"] == ["Week T1"]
    task = find_task(client.get("/api/plan").json(), "2031-03-03-learn")
    assert task["time"] == "07:00-08:30" and task["resources"] == "MDN"
    assert task["week"]["goal"] == "Testing" and task["month"]["title"] == "Test month"
    day = task["week"]["days"][0]
    assert day["focus"] == "Focus day"


def test_import_same_week_start_updates_title(client):
    import_week(client)
    res = client.post("/api/import", json={"weeks": [{"title": "Renamed", "start": "2031-03-03", "end": "2031-03-09"}]})
    assert res.json()["summary"]["updatedWeeks"] == ["Renamed"]


def test_import_refuses_existing_id_and_saves_nothing(client):
    import_week(client)
    body = {"tasks": [{"date": "2031-03-05", "type": "learn", "text": "New"},
                      {"id": "2031-03-03-learn", "date": "2031-03-05", "type": "learn", "text": "Dupe"}]}  # fmt: skip
    res = client.post("/api/import", json=body)
    assert res.status_code == 400
    assert "already exists" in res.json()["error"]
    assert find_task(client.get("/api/plan").json(), "2031-03-05-learn") is None  # all or nothing


def test_import_refuses_overlapping_weeks(client):
    import_week(client)
    res = client.post("/api/import", json={"weeks": [{"title": "Clash", "start": "2031-03-05", "end": "2031-03-12"}]})
    assert res.status_code == 400
    assert "overlap" in res.json()["error"]


def test_import_validation_errors_are_422(client):
    for body in [
        {"unknown": []},
        {"tasks": [{"date": "2031-03-03", "type": "dancing", "text": "x"}]},
        {"tasks": [{"date": "2031-02-30", "type": "learn", "text": "x"}]},
        {"tasks": [{"date": "2031-03-03", "type": "learn", "text": "   "}]},
        {"tasks": [{"date": "2031-03-03", "type": "learn", "text": "x" * 1001}]},
        {"weeks": [{"title": "Backwards", "start": "2031-03-09", "end": "2031-03-03"}]},
        {"routine": {"holiday": []}},
    ]:
        res = client.post("/api/import", json=body)
        assert res.status_code == 422, body
        assert res.json()["error"] == "Invalid request"


# --- Tasks ---


def test_create_task_makes_its_month_week_and_day(client):
    res = client.post("/api/tasks", json={"date": "2031-05-14", "type": "personal", "text": "Dentist", "time": "Lunch"})
    assert res.status_code == 201
    task_id = res.json()["id"]
    assert task_id.startswith("custom-2031-05-14-")
    task = find_task(client.get("/api/plan").json(), task_id)
    assert task["month"]["title"] == "May 2031"
    assert (task["week"]["start"], task["week"]["end"]) == ("2031-05-12", "2031-05-18")  # Monday to Sunday


def test_new_week_is_trimmed_next_to_an_existing_week(client):
    # A week that starts on a Wednesday; a task on the Tuesday before needs a new
    # week, which must stop on that Tuesday instead of overlapping (ported from the JS tests).
    client.post("/api/import", json={"weeks": [{"title": "Midweek", "start": "2031-03-05", "end": "2031-03-09"}]})
    task_id = client.post("/api/tasks", json={"date": "2031-03-04", "type": "learn", "text": "Early"}).json()["id"]
    week = find_task(client.get("/api/plan").json(), task_id)["week"]
    assert (week["start"], week["end"]) == ("2031-03-03", "2031-03-04")


def test_add_week_may_not_run_into_the_next_month(client):
    client.post("/api/months", json={"title": "A", "start": "2031-03-03", "end": "2031-03-09"})
    client.post("/api/months", json={"title": "B", "start": "2031-03-12", "end": "2031-03-31"})
    a = next(m for m in client.get("/api/plan").json()["months"] if m["title"] == "A")
    client.post(f"/api/months/{a['id']}/weeks")  # 3-9 March: fits
    res = client.post(f"/api/months/{a['id']}/weeks")  # 10-16 March: runs into B
    assert res.status_code == 400 and "overlap" in res.json()["error"]


def test_edit_and_move_keep_id_and_tick(client):
    import_week(client)
    client.put("/api/ticks/tasks/2031-03-03-learn", json={"done": True})
    res = client.patch("/api/tasks/2031-03-03-learn", json={"text": "Edited", "date": "2031-03-06", "time": "Work hour"})
    assert res.status_code == 200
    task = find_task(client.get("/api/plan").json(), "2031-03-03-learn")
    assert (task["date"], task["text"], task["time"]) == ("2031-03-06", "Edited", "Work hour")
    assert client.get("/api/progress").json()["2031-03-03-learn"] is True


def test_only_custom_tasks_can_be_deleted(client):
    import_week(client)
    assert client.delete("/api/tasks/2031-03-03-learn").status_code == 400
    mine = client.post("/api/tasks", json={"date": "2031-03-04", "type": "personal", "text": "Mine"}).json()["id"]
    assert client.delete(f"/api/tasks/{mine}").status_code == 200
    assert find_task(client.get("/api/plan").json(), mine) is None


def test_unknown_task_is_404(client):
    assert client.patch("/api/tasks/nope", json={"text": "x"}).status_code == 404
    assert client.put("/api/ticks/tasks/nope", json={"done": True}).status_code == 404


# --- Ticks ---


def test_tick_and_untick_write_history(client, db):
    import_week(client)
    assert client.put("/api/ticks/tasks/2031-03-03-learn", json={"done": True}).json() == {"changed": 1}
    assert client.put("/api/ticks/tasks/2031-03-03-learn", json={"done": True}).json() == {"changed": 0}
    assert client.put("/api/ticks/tasks/2031-03-03-learn", json={"done": False}).json() == {"changed": 1}
    events = db.scalars(select(TickEvent.action).where(TickEvent.ref == "2031-03-03-learn").order_by(TickEvent.id))
    assert list(events) == ["tick", "untick"]


def test_tick_must_be_a_real_boolean(client):
    import_week(client)
    for body in [{"done": "yes"}, {"done": 1}, {}, {"done": True, "extra": 1}]:
        assert client.put("/api/ticks/tasks/2031-03-03-learn", json=body).status_code == 422, body


def test_routine_tick(client):
    assert client.put("/api/ticks/routine/2031-03-03/test-wake", json={"done": True}).status_code == 200
    assert client.get("/api/progress").json()["routine-2031-03-03-test-wake"] is True
    assert client.put("/api/ticks/routine/2031-02-30/test-wake", json={"done": True}).status_code == 422
    assert client.put("/api/ticks/routine/2031-03-03/Bad_Key", json={"done": True}).status_code == 422


def test_bulk_ticks_all_or_nothing(client):
    import_week(client)
    ticks = {"2031-03-03-learn": True, "2031-03-03-learn-2": True, "routine-2031-03-03-test-wake": True}
    assert client.put("/api/ticks", json={"ticks": ticks}).json() == {"changed": 3}

    res = client.put("/api/ticks", json={"ticks": {"2031-03-03-learn": False, "nope": True}})
    assert res.status_code == 404
    assert client.get("/api/progress").json()["2031-03-03-learn"] is True  # unchanged


# --- Months and weeks ---


def test_month_create_overlap_and_edit(client):
    res = client.post("/api/months", json={"title": "Test June", "start": "2031-06-01", "end": "2031-06-30"})
    assert res.status_code == 201
    month_id = res.json()["id"]
    clash = client.post("/api/months", json={"title": "Clash", "start": "2031-06-15", "end": "2031-07-15"})
    assert clash.status_code == 400 and "overlap" in clash.json()["error"]
    assert client.patch(f"/api/months/{month_id}", json={"title": "June!", "start": "2031-06-01",
                                                         "end": "2031-06-20"}).status_code == 200  # fmt: skip


def test_month_edit_refused_when_a_week_would_fall_outside(client):
    import_week(client)
    month = find_task(client.get("/api/plan").json(), "2031-03-03-learn")["month"]
    res = client.patch(f"/api/months/{month['id']}", json={"title": "x", "start": "2031-03-05", "end": "2031-03-31"})
    assert res.status_code == 400 and "outside the month" in res.json()["error"]


def test_add_week_and_edit_week(client):
    import_week(client)
    month = find_task(client.get("/api/plan").json(), "2031-03-03-learn")["month"]
    res = client.post(f"/api/months/{month['id']}/weeks")
    assert res.status_code == 201
    week_id = res.json()["id"]
    assert client.patch(f"/api/weeks/{week_id}", json={"title": "Week T2", "goal": "More"}).status_code == 200
    plan = client.get("/api/plan").json()
    month = next(m for m in plan["months"] if m["id"] == month["id"])
    added = next(w for w in month["weeks"] if w["id"] == week_id)
    assert (added["start"], added["end"], added["title"]) == ("2031-03-10", "2031-03-16", "Week T2")
    assert month["end"] == "2031-03-16"  # stretched


def test_delete_week_dry_run_then_delete(client):
    import_week(client)
    client.put("/api/ticks/tasks/2031-03-03-learn", json={"done": True})
    week_id = find_task(client.get("/api/plan").json(), "2031-03-03-learn")["week"]["id"]
    preview = client.delete(f"/api/weeks/{week_id}?dry_run=true").json()
    assert preview == {"dryRun": True, "tasks": 2, "ticks": 1}
    assert find_task(client.get("/api/plan").json(), "2031-03-03-learn") is not None
    assert client.delete(f"/api/weeks/{week_id}").json()["dryRun"] is False
    assert find_task(client.get("/api/plan").json(), "2031-03-03-learn") is None
    assert "2031-03-03-learn" not in client.get("/api/progress").json()  # its tick went with it


def test_delete_month(client):
    import_week(client)
    month_id = find_task(client.get("/api/plan").json(), "2031-03-03-learn")["month"]["id"]
    assert client.delete(f"/api/months/{month_id}").json() == {"dryRun": False, "tasks": 2, "ticks": 0}
    assert all(m["id"] != month_id for m in client.get("/api/plan").json()["months"])


# --- Routine ---


def test_routine_replace_keeps_matching_ids_and_refuses_overlap(client):
    original = client.get("/api/routine").json()["sunday"]
    blocks = [{"start": "06:00", "label": "Wake up", "kind": "wake", "tickable": True},
              {"id": "test-read", "start": "09:00", "end": "10:00", "label": "Read", "kind": "rest"}]  # fmt: skip
    res = client.put("/api/routine/sunday", json=blocks)
    assert res.status_code == 200
    sunday = res.json()["sunday"]
    assert [b["id"] for b in sunday][1] == "test-read"
    wake = next((b for b in original if b["label"] == "Wake up"), None)
    assert sunday[0]["id"] == (wake["id"] if wake else "wake-up")

    clash = [{"start": "09:00", "end": "10:00", "label": "A", "kind": "rest"},
             {"start": "09:30", "end": "11:00", "label": "B", "kind": "fun"}]  # fmt: skip
    res = client.put("/api/routine/sunday", json=clash)
    assert res.status_code == 400 and "overlap" in res.json()["error"]
    bad = [{"start": "10:00", "end": "09:00", "label": "Backwards", "kind": "rest"}]
    assert client.put("/api/routine/sunday", json=bad).status_code == 422
