"""Reschedule and undo (Phase 8). Dates in 2031, inside a rolled-back transaction.
2031-03-03 is a Monday."""

from tests.test_api import find_task, import_week


def setup_two_weeks(client):
    """Week T1 (3-9 March): tasks on Mon 3, Tue 4, Wed 5 (Wed 5 done).
    Week T2 (10-16 March): tasks on Mon 10 and Wed 12 (Wed 12 done)."""
    import_week(client)  # two learn tasks on Mon 3
    client.post("/api/import", json={"weeks": [{"monthTitle": "Test month", "title": "Week T2", "start": "2031-03-10",
                                                "end": "2031-03-16"}]})  # fmt: skip
    ids = {}
    for d in ["2031-03-04", "2031-03-05", "2031-03-10", "2031-03-12"]:
        ids[d] = client.post("/api/tasks", json={"date": d, "type": "learn", "text": f"Task {d}"}).json()["id"]
    for d in ["2031-03-05", "2031-03-12"]:
        client.put(f"/api/ticks/tasks/{ids[d]}", json={"done": True})
    return ids


def shift(client, from_date, new_start, dry_run=False):
    return client.post(f"/api/reschedule?dry_run={str(dry_run).lower()}", json={"fromDate": from_date, "newStart": new_start})


def test_dry_run_previews_and_saves_nothing(client):
    setup_two_weeks(client)
    before = client.get("/api/plan").json()
    res = shift(client, "2031-03-04", "2031-03-11", dry_run=True)
    assert res.status_code == 200, res.text
    p = res.json()
    assert (p["dryRun"], p["days"], p["wholeWeeks"], p["shiftId"]) == (True, 7, True, None)
    assert [(m["date"], m["newDate"]) for m in p["moved"]] == [("2031-03-04", "2031-03-11"), ("2031-03-10", "2031-03-17")]
    assert p["kept"] == ["2031-03-05", "2031-03-12"]  # completed days never move
    assert p["unusual"] == []  # whole weeks keep every weekday
    assert client.get("/api/plan").json() == before
    assert client.get("/api/reschedule/last").json() is None or client.get("/api/reschedule/last").json()["fromDate"] != "2031-03-04"


def test_shift_by_a_week_then_undo_restores_everything(client):
    ids = setup_two_weeks(client)
    before = client.get("/api/plan").json()
    res = shift(client, "2031-03-04", "2031-03-11")
    assert res.status_code == 200, res.text
    plan = client.get("/api/plan").json()

    moved = find_task(plan, ids["2031-03-04"])
    assert moved["date"] == "2031-03-11" and moved["week"]["title"] == "Week T1"
    assert (moved["week"]["start"], moved["week"]["end"]) == ("2031-03-03", "2031-03-16")  # spans the from date: longer
    assert find_task(plan, ids["2031-03-10"])["date"] == "2031-03-17"
    assert find_task(plan, ids["2031-03-05"])["date"] == "2031-03-05"  # done: stays
    assert find_task(plan, "2031-03-03-learn")["date"] == "2031-03-03"  # before the from date: stays
    t2 = find_task(plan, ids["2031-03-10"])["week"]
    assert (t2["title"], t2["start"], t2["end"]) == ("Week T2", "2031-03-17", "2031-03-23")
    done12 = find_task(plan, ids["2031-03-12"])
    assert done12["date"] == "2031-03-12"  # done: stays, now inside the longer Week T1
    assert client.get("/api/progress").json()[ids["2031-03-05"]] is True  # ticks keep their ids

    last = client.get("/api/reschedule/last").json()
    assert (last["fromDate"], last["days"], last["undone"]) == ("2031-03-04", 7, False)
    assert client.post("/api/reschedule/undo").status_code == 200
    assert client.get("/api/plan").json() == before
    assert client.get("/api/reschedule/last").json()["undone"] is True
    assert client.post("/api/reschedule/undo").status_code == 404  # only once


def test_completed_day_left_behind_gets_a_new_week_and_undo_removes_it(client):
    ids = setup_two_weeks(client)
    before = client.get("/api/plan").json()
    assert shift(client, "2031-03-10", "2031-03-17").status_code == 200  # Week T2 starts on the from date: moves
    plan = client.get("/api/plan").json()
    kept = find_task(plan, ids["2031-03-12"])
    assert kept["date"] == "2031-03-12" and kept["week"]["title"] != "Week T2"  # T2 moved away; a new week holds it
    assert (kept["week"]["start"], kept["week"]["end"]) == ("2031-03-10", "2031-03-16")
    assert client.post("/api/reschedule/undo").status_code == 200
    assert client.get("/api/plan").json() == before


def test_part_week_shift_warns_about_unusual_weekdays(client):
    setup_two_weeks(client)
    p = shift(client, "2031-03-10", "2031-03-15", dry_run=True).json()  # Mon -> Sat: +5 days
    assert p["wholeWeeks"] is False
    assert {(u["date"], u["weekday"], u["type"]) for u in p["unusual"]} == {("2031-03-15", "Sat", "learn")}


def test_refusals(client):
    setup_two_weeks(client)
    assert shift(client, "2031-03-10", "2031-03-10").status_code == 400  # no move
    assert shift(client, "2031-03-10", "2031-03-03").status_code == 400  # backwards
    clash = shift(client, "2031-03-04", "2031-03-05")  # Tue 4 would land on the done Wed 5
    assert clash.status_code == 400 and "2031-03-05" in clash.json()["error"]
    assert shift(client, "2031-12-01", "2031-12-08").status_code == 400  # nothing to move
    assert shift(client, "2031-03-04", "2033-03-04").status_code == 400  # too far
    assert client.post("/api/reschedule", json={"fromDate": "2031-03-04"}).status_code == 422
