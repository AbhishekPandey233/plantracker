"""Shared test setup. pytest finds this file by name and gives its fixtures to every test:
a test that takes an argument called `client` gets the value made below."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import write_limiter
from app.db.session import engine, get_db
from app.main import app

# 127.0.0.1, because TrustedHostMiddleware refuses TestClient's default host "testserver".
BASE_URL = "http://127.0.0.1"
API_KEY = settings.api_key.get_secret_value()


@pytest.fixture
def client(db):
    """Calls the app like the Vite proxy does: with the API key.
    dependency_overrides swaps get_db for the test's throw-away session, so
    endpoints never change the real data."""

    def test_get_db():
        # Like the real get_db: a refused request (an exception) throws away its
        # unsaved changes. Here that rolls back to the last commit's savepoint.
        try:
            yield db
        except Exception:
            db.rollback()
            raise

    app.dependency_overrides[get_db] = test_get_db
    yield TestClient(app, base_url=BASE_URL, headers={"X-API-Key": API_KEY})
    app.dependency_overrides.clear()


@pytest.fixture
def anon(client):
    """Calls the app without the API key (same throw-away session)."""
    return TestClient(app, base_url=BASE_URL)


@pytest.fixture
def db():
    """A database session whose changes are ALWAYS thrown away after the test.

    Tests run against the real plan_tracker database, so: open a transaction, let the
    test work inside it (commit() inside the test only releases a savepoint), and roll
    the whole thing back at the end. The real data is never changed."""
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    """autouse: runs around every test, so writes in one test never count towards another's limit."""
    write_limiter.times.clear()
    yield
    write_limiter.times.clear()
