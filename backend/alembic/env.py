"""Alembic runs this file for every migration command.

A migration is a small script that changes the database structure step by step
(create a table, add a column). Alembic records the latest one it ran in the
alembic_version table, so `alembic upgrade head` only runs the new ones.

Migrations connect as plan_owner (the only role allowed to create or change tables),
never as plan_app.
"""

from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context
from app.core.config import settings
from app.models.tables import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Alembic compares this (our models) with the real database for --autogenerate.
target_metadata = Base.metadata
OWNER_URL = settings.database_url("plan_owner")


def run_migrations_offline() -> None:
    """`alembic upgrade head --sql`: prints the SQL instead of running it."""
    context.configure(url=OWNER_URL, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(OWNER_URL, poolclass=pool.NullPool)
    with engine.connect() as connection:
        # compare_type: also notice changed column types (e.g. a longer varchar).
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        # PostgreSQL can change tables inside a transaction, so a failed migration
        # leaves nothing half-done.
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
