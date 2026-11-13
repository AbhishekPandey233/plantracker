import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.core.security import SECURITY_HEADERS, SecurityMiddleware
from app.routers import health, journal, months, plan, reschedule, tasks, ticks

setup_logging(settings.log_file)

# docs_url/openapi_url = None switches the /docs page off completely.
app = FastAPI(
    title="Plan Tracker API",
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)

# Middleware order: the one added LAST runs FIRST. So a request goes through
#   log_and_harden -> TrustedHostMiddleware -> SecurityMiddleware -> the endpoint
app.add_middleware(SecurityMiddleware)  # Origin, API key, rate limit, JSON only, 1 MB
# Only answer to these Host names. Stops "DNS rebinding": a malicious site pointing
# its own domain name at 127.0.0.1 to get past the browser's same-origin rule.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])


@app.middleware("http")
async def log_and_harden(request: Request, call_next):
    """Outermost layer: times and logs every request (refused ones too), turns any
    crash into a generic 500, and adds the security headers to every response.
    Only method, path, status and duration are logged: never headers (the API key)
    or bodies (journal text)."""
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        # Full details (traceback) go to the log file only; the caller learns nothing.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        response = JSONResponse({"error": "Something went wrong on the server"}, status_code=500)
    response.headers.update(SECURITY_HEADERS)
    ms = (time.perf_counter() - start) * 1000
    logger.info("%s %s %s %.1fms", request.method, request.url.path, response.status_code, ms)
    return response


# Exception handlers: turn FastAPI's own errors into the same {"error": ...} shape.
@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Field and message only, never the value that was sent (it might be journal text).
    details = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
    return JSONResponse({"error": "Invalid request", "details": details}, status_code=422)


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc: IntegrityError):
    # A database rule (CHECK, UNIQUE, ...) refused the change. The schemas should catch
    # bad input first; this is the safety net. Details go to the log only.
    logger.warning("Database rule refused %s %s: %s", request.method, request.url.path, exc.orig.__class__.__name__)
    return JSONResponse({"error": "That change breaks a rule of the plan data"}, status_code=400)


# Every router here is protected by SecurityMiddleware (API key etc.) automatically.
for router_module in (health, plan, ticks, tasks, months, journal, reschedule):
    app.include_router(router_module.router)


def openapi_with_api_key():
    """Adds an "Authorize" button to /docs: paste the API key once and every
    "Try it out" request sends it as X-API-Key."""
    if app.openapi_schema is None:
        schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
        schema.setdefault("components", {})["securitySchemes"] = {
            "ApiKey": {"type": "apiKey", "in": "header", "name": "X-API-Key"}
        }
        schema["security"] = [{"ApiKey": []}]
        app.openapi_schema = schema
    return app.openapi_schema


app.openapi = openapi_with_api_key
