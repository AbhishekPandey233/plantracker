"""plan_app (the role the app runs as) may read and write rows, but never change tables."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.db.session import engine


def run_as_app(sql: str) -> None:
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.rollback()  # never keep anything a test did


def test_app_can_read():
    run_as_app("SELECT count(*) FROM tasks")


def test_app_can_write_rows():
    # tick_events has an auto-numbered id, so this also checks sequence rights.
    run_as_app("INSERT INTO tick_events (kind, ref, action) VALUES ('task', 'test', 'tick')")


@pytest.mark.parametrize(
    "sql",
    [
        "CREATE TABLE sneaky (id int)",
        "DROP TABLE tasks",
        "ALTER TABLE tasks ADD COLUMN sneaky int",
        "TRUNCATE tasks",
    ],
)
def test_app_cannot_change_tables(sql):
    # ProgrammingError wraps PostgreSQL's "permission denied" / "must be owner".
    with pytest.raises(ProgrammingError):
        run_as_app(sql)
