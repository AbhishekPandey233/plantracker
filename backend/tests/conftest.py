"""Shared test setup. pytest finds this file by name and gives its fixtures to every test:
a test that takes an argument called `client` gets the value made below."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import write_limiter
from app.main import app

# 127.0.0.1, because TrustedHostMiddleware refuses TestClient's default host "testserver".
BASE_URL = "http://127.0.0.1"
API_KEY = settings.api_key.get_secret_value()


@pytest.fixture
def client():
    """Calls the app like the Vite proxy does: with the API key."""
    return TestClient(app, base_url=BASE_URL, headers={"X-API-Key": API_KEY})


@pytest.fixture
def anon():
    """Calls the app without the API key."""
    return TestClient(app, base_url=BASE_URL)


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    """autouse: runs around every test, so writes in one test never count towards another's limit."""
    write_limiter.times.clear()
    yield
    write_limiter.times.clear()
