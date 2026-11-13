import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

logger = logging.getLogger("plan_tracker")


def setup_logging(log_file: Path) -> None:
    """Request log in backend/logs/app.log: when the file reaches 1 MB it becomes
    app.log.1 (up to 5 old files), so the log never fills the disk."""
    if logger.handlers:  # already set up (uvicorn --reload imports the app again)
        return
    log_file.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(log_file, maxBytes=1_000_000, backupCount=5, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
