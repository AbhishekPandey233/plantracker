-- One-time setup. Run as the postgres superuser with psql (see backend/README.md):
-- the passwords come in as psql variables (:'owner_pw', :'app_pw'), read from backend/.env,
-- so they are never written in this file.

-- Two roles (database users):
--   plan_owner owns the database and its tables; only Alembic migrations log in as it.
--   plan_app is what the running app uses: it can read and change rows, nothing else.
CREATE ROLE plan_owner LOGIN PASSWORD :'owner_pw';
CREATE ROLE plan_app LOGIN PASSWORD :'app_pw';

CREATE DATABASE plan_tracker OWNER plan_owner;

-- By default every role may connect to a new database; allow only our two.
REVOKE ALL ON DATABASE plan_tracker FROM PUBLIC;
GRANT CONNECT ON DATABASE plan_tracker TO plan_app;

-- The rest happens inside the new database.
\connect plan_tracker

-- In PostgreSQL 15+ the public schema belongs to the database owner (plan_owner),
-- and other roles can't create anything in it. plan_app may only use it.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO plan_app;

-- Default privileges: every table and sequence plan_owner creates from now on
-- (through migrations) automatically gives plan_app these rights, and no more.
-- Sequences are the counters behind auto-numbered ids.
ALTER DEFAULT PRIVILEGES FOR ROLE plan_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO plan_app;
ALTER DEFAULT PRIVILEGES FOR ROLE plan_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO plan_app;

-- Only accept connections from this laptop. Written to postgresql.auto.conf;
-- takes effect after the PostgreSQL service restarts.
ALTER SYSTEM SET listen_addresses = 'localhost';
