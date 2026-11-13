def test_health_needs_no_key(anon):
    res = anon.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
