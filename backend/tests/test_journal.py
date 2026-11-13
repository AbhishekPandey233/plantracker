"""Journal and history (Phase 7). Dates in 2031, inside a rolled-back transaction."""

import logging

from tests.test_api import import_week

DAY = "2031-03-03"


def test_journal_starts_empty_then_saves_and_updates(client):
    empty = client.get(f"/api/journal/{DAY}").json()
    assert empty["exists"] is False and empty["learned"] == "" and empty["mood"] is None

    res = client.put(f"/api/journal/{DAY}", json={"learned": "  Closures\nand scope ", "mood": 4})
    assert res.status_code == 200
    saved = client.get(f"/api/journal/{DAY}").json()
    assert (saved["exists"], saved["learned"], saved["mood"], saved["struggled"]) == (True, "Closures\nand scope", 4, "")

    client.put(f"/api/journal/{DAY}", json={"learned": "Closures", "struggled": "this", "mood": None})
    again = client.get(f"/api/journal/{DAY}").json()
    assert (again["struggled"], again["mood"]) == ("this", None)


def test_empty_journal_is_deleted(client):
    client.put(f"/api/journal/{DAY}", json={"notes": "x"})
    client.put(f"/api/journal/{DAY}", json={"learned": "  ", "notes": ""})
    assert client.get(f"/api/journal/{DAY}").json()["exists"] is False


def test_journal_validation(client):
    for body in [{"mood": 0}, {"mood": 6}, {"mood": "5"}, {"mood": 3.5}, {"learned": "x" * 5001}, {"feelings": "?"}]:
        assert client.put(f"/api/journal/{DAY}", json=body).status_code == 422, body
    assert client.put("/api/journal/2031-02-30", json={}).status_code == 422


def test_journal_text_is_stored_as_plain_text(client):
    html = '<img src=x onerror="alert(1)"> <b>bold</b>'
    client.put(f"/api/journal/{DAY}", json={"notes": html})
    assert client.get(f"/api/journal/{DAY}").json()["notes"] == html  # stored as-is; React shows it as text


def test_journal_text_never_reaches_the_log(client, caplog):
    secret = "my-private-journal-words"
    with caplog.at_level(logging.DEBUG):
        client.put(f"/api/journal/{DAY}", json={"learned": secret})
        client.put(f"/api/journal/{DAY}", json={"mood": 9, "learned": secret})  # a refused one too
    assert secret not in caplog.text


def history(client, **params):
    params = {"from": "2031-03-01", "to": "2031-03-09", "today": "2031-03-05", **params}
    res = client.get("/api/history", params=params)
    assert res.status_code == 200, res.text
    return res.json()


def test_history_statuses_tasks_routine_and_journal(client):
    import_week(client)  # 2031-03-03 has two learn tasks
    client.post("/api/tasks", json={"date": "2031-03-04", "type": "personal", "text": "Gym"})
    client.post("/api/tasks", json={"date": "2031-03-07", "type": "personal", "text": "Later"})
    client.put("/api/ticks/tasks/2031-03-03-learn", json={"done": True})
    client.put("/api/ticks/routine/2031-03-03/test-wake", json={"done": True})
    client.put("/api/journal/2031-03-03", json={"learned": "First line\nsecond line"})
    client.put("/api/journal/2031-03-02", json={"notes": "a day without tasks"})

    days = history(client)
    assert [d["date"] for d in days] == ["2031-03-07", "2031-03-04", "2031-03-03", "2031-03-02"]  # newest first
    by_date = {d["date"]: d for d in days}
    d3 = by_date["2031-03-03"]
    assert (d3["status"], d3["done"], d3["total"]) == ("partial", 1, 2)
    assert [t["done"] for t in d3["tasks"]] == [True, False]
    assert d3["routineTicked"] == ["test-wake"]
    assert (d3["hasJournal"], d3["learned"]) == (True, "First line")
    assert by_date["2031-03-04"]["status"] == "missed"
    assert by_date["2031-03-07"]["status"] == "upcoming"
    assert (by_date["2031-03-02"]["status"], by_date["2031-03-02"]["hasJournal"]) == ("empty", True)


def test_history_search_is_case_insensitive_and_literal(client):
    import_week(client)
    client.put("/api/journal/2031-03-03", json={"learned": "Learned about SQL JOINs, 100% sure"})
    client.put("/api/journal/2031-03-04", json={"struggled": "joins again"})
    client.put("/api/journal/2031-03-05", json={"notes": "nothing related"})

    assert [d["date"] for d in history(client, q="JOIN")] == ["2031-03-04", "2031-03-03"]
    assert [d["date"] for d in history(client, q="100%")] == ["2031-03-03"]
    # % and _ are literal characters, not "match everything" / "any character":
    assert [d["date"] for d in history(client, q="%")] == ["2031-03-03"]  # only the entry with a real %
    assert history(client, q="%%") == []
    assert history(client, q="_") == []
    assert history(client, q="'; DROP TABLE tasks; --") == []  # just text, sent as a parameter


def test_history_limits(client):
    assert client.get("/api/history", params={"from": "2031-03-09", "to": "2031-03-01"}).status_code == 400
    assert client.get("/api/history", params={"from": "2030-01-01", "to": "2031-12-31"}).status_code == 400
    assert client.get("/api/history", params={"q": "x" * 101}).status_code == 422
    assert client.get("/api/history").status_code == 200  # defaults: the last 400 days up to today
