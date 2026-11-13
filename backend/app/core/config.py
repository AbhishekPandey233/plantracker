from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../backend


# pydantic-settings reads each field from an environment variable of the same name
# (case-insensitive), falling back to backend/.env, then to the default here.
# Wrong types or a missing password stop the app at startup with a clear error.
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    enable_docs: bool = False  # /docs page; switch on in .env while developing
    api_key: SecretStr  # every request except /api/health must send it as X-API-Key
    log_file: Path = BACKEND_DIR / "logs" / "app.log"

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "plan_tracker"
    # SecretStr hides the value when printed or logged (shows '**********').
    plan_app_password: SecretStr  # app role: reads and writes data only
    plan_owner_password: SecretStr  # owner role: only Alembic migrations use it

    def database_url(self, role: str = "plan_app") -> URL:
        """Connection URL for a role. URL.create escapes special characters in the password."""
        password = self.plan_owner_password if role == "plan_owner" else self.plan_app_password
        return URL.create(
            "postgresql+psycopg",  # SQLAlchemy talks to PostgreSQL through the psycopg driver
            username=role,
            password=password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )


settings = Settings()
