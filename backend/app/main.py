import time

from fastapi import FastAPI, Request

from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.routers import health

setup_logging(settings.log_file)

# docs_url/openapi_url = None switches the /docs page off completely.
app = FastAPI(
    title="Plan Tracker API",
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)


# Middleware: code that runs around every request. call_next passes the request on
# to the endpoint and gives back its response, so we can time it.
# Only method, path, status and duration are logged: never headers (the API key)
# or bodies (journal text).
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    logger.info("%s %s %s %.1fms", request.method, request.url.path, response.status_code, ms)
    return response


app.include_router(health.router)
