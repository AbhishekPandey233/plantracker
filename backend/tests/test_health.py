from fastapi.testclient import TestClient

from app.main import app

# TestClient calls the app directly in memory (through httpx): no server needed.
client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
