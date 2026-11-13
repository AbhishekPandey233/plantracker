from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# The engine holds a pool of open connections to PostgreSQL (as plan_app).
# It connects lazily: nothing happens until the first query.
# pool_pre_ping checks a connection still works before using it (e.g. after a PostgreSQL restart).
engine = create_engine(settings.database_url("plan_app"), pool_pre_ping=True)

# A session is one "conversation" with the database: queries and changes collected
# into a transaction, which is saved with commit() or thrown away with rollback().
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    """FastAPI dependency: an endpoint that takes `db: Session = Depends(get_db)` gets
    a fresh session per request; the `with` block closes it when the request ends
    (anything not committed is rolled back)."""
    with SessionLocal() as db:
        yield db
