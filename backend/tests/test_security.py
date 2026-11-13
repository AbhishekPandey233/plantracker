"""One test per security rule. /api/anything doesn't exist: the security checks run
before routing, so a request that passes them gets 404, one that fails gets refused."""

import pytest
from fastapi.testclient import TestClient

from app.core.security import MAX_BODY_BYTES, write_limiter
from app.main import app
from tests.conftest import API_KEY, BASE_URL

URL = "/api/anything"


# --- API key ---


def test_no_key_is_401(anon):
    res = anon.get(URL)
    assert res.status_code == 401
    assert res.json() == {"error": "Missing or wrong API key"}


def test_wrong_key_is_401(anon):
    assert anon.get(URL, headers={"X-API-Key": "wrong"}).status_code == 401
    assert anon.get(URL, headers={"X-API-Key": API_KEY + "x"}).status_code == 401


def test_right_key_passes(client):
    assert client.get(URL).status_code == 404  # got past security, route just doesn't exist


def test_unknown_paths_outside_api_need_the_key_too(anon):
    assert anon.get("/").status_code == 401


# --- Host ---


@pytest.mark.parametrize("host", ["evil.example", "192.168.1.5", "localhost.evil.example"])
def test_wrong_host_is_refused(host):
    other = TestClient(app, base_url=f"http://{host}", headers={"X-API-Key": API_KEY})
    assert other.get("/api/health").status_code == 400


def test_localhost_with_port_is_fine():
    local = TestClient(app, base_url="http://localhost:8000")
    assert local.get("/api/health").status_code == 200


# --- Origin and Sec-Fetch-Site ---


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_app_origins_are_allowed(client, origin):
    assert client.get(URL, headers={"Origin": origin}).status_code == 404


@pytest.mark.parametrize("origin", ["https://evil.example", "http://localhost:3000", "null"])
def test_other_origins_are_403(client, origin):
    assert client.get(URL, headers={"Origin": origin}).status_code == 403


def test_cross_site_fetch_is_403(client):
    assert client.get(URL, headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403


def test_same_origin_fetch_is_fine(client):
    assert client.get(URL, headers={"Sec-Fetch-Site": "same-origin"}).status_code == 404


# --- Content type and size ---


def test_json_write_passes(client):
    assert client.put(URL, json={"done": True}).status_code == 404


@pytest.mark.parametrize("content_type", ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])
def test_non_json_write_is_415(client, content_type):
    res = client.post(URL, content=b'{"done": true}', headers={"Content-Type": content_type})
    assert res.status_code == 415


def test_write_without_content_type_is_415(client):
    assert client.post(URL, content=b"done").status_code == 415


def test_delete_without_body_is_fine(client):
    assert client.delete(URL).status_code == 404


def test_oversized_body_is_413(client):
    big = b'"' + b"x" * MAX_BODY_BYTES + b'"'
    res = client.put(URL, content=big, headers={"Content-Type": "application/json"})
    assert res.status_code == 413


def test_oversized_chunked_body_is_413(client):
    # A generator body is sent in chunks without a Content-Length header.
    def chunks():
        for _ in range(11):
            yield b"x" * 100_000

    res = client.put(URL, content=chunks(), headers={"Content-Type": "application/json"})
    assert res.status_code == 413


# --- Rate limit ---


def test_rate_limit_is_429(client):
    for _ in range(write_limiter.limit):
        assert client.put(URL, json={}).status_code == 404
    res = client.put(URL, json={})
    assert res.status_code == 429
    assert client.get(URL).status_code == 404  # reads are never limited


# --- Headers and errors ---


def test_security_headers_on_every_response(client, anon):
    for res in [anon.get("/api/health"), anon.get(URL), client.get(URL)]:
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["X-Frame-Options"] == "DENY"
        assert res.headers["Referrer-Policy"] == "no-referrer"
        assert res.headers["Cache-Control"] == "no-store"


def test_crash_gives_generic_500_without_details(client):
    def boom():
        raise RuntimeError("secret internal detail")

    app.add_api_route("/api/test-boom", boom)
    try:
        res = client.get("/api/test-boom")
    finally:
        app.router.routes.pop()  # remove the test route again
    assert res.status_code == 500
    assert res.json() == {"error": "Something went wrong on the server"}
    assert "secret" not in res.text
    assert res.headers["X-Frame-Options"] == "DENY"


def test_no_cors_headers(client):
    res = client.options(URL, headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "PUT"})
    assert "access-control-allow-origin" not in res.headers
