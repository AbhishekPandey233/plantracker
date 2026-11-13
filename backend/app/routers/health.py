from fastapi import APIRouter

# A router is a group of endpoints; main.py plugs each router into the app.
router = APIRouter()


@router.get("/api/health")
def health() -> dict:
    """Is the backend running? Stays open without the API key (Phase 3)."""
    return {"status": "ok"}
