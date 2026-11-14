"""Export and restore (Phase 10), inside a rolled-back transaction."""

DAY = "2031-04-07"


def test_export_restore_round_trip(client):
    client.put(f"/api/journal/{DAY}", json={"learned": "Backups", "mood": 5})
    backup = client.get("/api/export").json()
    assert backup["version"] == 1 and backup["plan"]["months"] is not None
    assert any(e["date"] == DAY for e in backup["journal"])

    # Lose some data: the journal entry and one tick.
    client.put(f"/api/journal/{DAY}", json={})
    first_task = next((t for m in backup["plan"]["months"] for w in m["weeks"] for d in w["days"] for t in d["tasks"]), None)
    if first_task:
        client.put(f"/api/ticks/tasks/{first_task['id']}", json={"done": not backup["progress"].get(first_task["id"], False)})

    res = client.post("/api/restore", json=backup)
    assert res.status_code == 200, res.text
    after = client.get("/api/export").json()
    assert after["plan"] == backup["plan"]
    assert after["progress"] == backup["progress"]
    restored = next(e for e in after["journal"] if e["date"] == DAY)
    assert (restored["learned"], restored["mood"]) == ("Backups", 5)


def test_restore_refuses_bad_files_and_saves_nothing(client):
    before = client.get("/api/export").json()
    bad = [
        {"version": 2, "plan": {"months": []}},
        {"version": 1, "plan": {}},  # no months
        {"version": 1, "plan": {"months": [{"id": "m9"}]}},  # month without fields
        {"version": 1, "plan": {"months": []}, "journal": [{"date": "2031-02-30"}]},
        {"version": 1, "plan": {"months": []}, "journal": [{"date": DAY, "mood": 9}]},
        {"version": 1, "plan": {"months": []}, "progress": {"x": "yes"}},
        {"version": 1, "plan": {"months": []}, "hack": True},
    ]
    for body in bad:
        res = client.post("/api/restore", json=body)
        assert res.status_code in (400, 422), (body, res.status_code)
        assert "Traceback" not in res.text
    assert client.get("/api/export").json() == before


def test_export_needs_the_api_key(anon):
    assert anon.get("/api/export").status_code == 401
