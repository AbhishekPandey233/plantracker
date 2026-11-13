from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../backend


# pydantic-settings reads each field from an environment variable of the same name
# (case-insensitive), falling back to backend/.env, then to the default here.
# Wrong types (e.g. ENABLE_DOCS=maybe) stop the app at startup with a clear error.
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    enable_docs: bool = False  # /docs page; switch on in .env while developing
    log_file: Path = BACKEND_DIR / "logs" / "app.log"


settings = Settings()
