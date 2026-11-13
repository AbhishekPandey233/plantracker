"""Security checks that run on every request, before any endpoint.

Done as middleware (code wrapped around every request), not per router, so a new
endpoint is protected automatically: nobody can forget to add the API key check.
Every refusal is a small JSON {"error": "..."} and the endpoint never runs.
"""

import secrets
import time
from collections import deque

from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from app.core.config import settings

# Anyone may call these without the API key. /docs and /openapi.json only exist
# when ENABLE_DOCS=true; the docs page sends the key itself once you click Authorize.
PUBLIC_PATHS = {"/api/health", "/docs", "/docs/oauth2-redirect", "/openapi.json"}

# The Vite dev server (the app) and the backend itself (the /docs page).
ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
}

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
MAX_BODY_BYTES = 1_000_000  # 1 MB; the whole plan is far smaller

# Added to every response by main.py (including errors).
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",  # browser must trust our Content-Type, not guess
    "X-Frame-Options": "DENY",  # no other page may show us in a frame
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",  # never keep a copy of plan data in a cache
}


class RateLimiter:
    """At most `limit` writes in any 60 seconds, for the whole app.

    ponytail: one global counter in memory (one user, one process); it resets when
    the backend restarts. Per-client counters would only matter with more users.
    """

    def __init__(self, limit: int = 120, window: float = 60.0):
        self.limit = limit
        self.window = window
        self.times: deque[float] = deque()  # when each recent write arrived

    def allow(self) -> bool:
        now = time.monotonic()
        while self.times and now - self.times[0] > self.window:
            self.times.popleft()  # forget writes older than the window
        if len(self.times) >= self.limit:
            return False
        self.times.append(now)
        return True


write_limiter = RateLimiter()


def key_is_valid(sent: str | None) -> bool:
    # compare_digest takes the same time whether the first or the last character
    # is wrong, so nobody can guess the key one character at a time by timing.
    expected = settings.api_key.get_secret_value().encode()
    return sent is not None and secrets.compare_digest(sent.encode(), expected)


def check_request(method: str, path: str, headers: Headers) -> tuple[int, str] | None:
    """Returns (status, message) when the request must be refused, else None."""
    origin = headers.get("origin")
    # No Origin header is fine (same-origin GETs often don't send one).
    if origin is not None and origin not in ALLOWED_ORIGINS:
        return 403, "Requests from other websites are not allowed"
    # Sec-Fetch-Site is set by the browser (pages can't fake it).
    if headers.get("sec-fetch-site") == "cross-site":
        return 403, "Requests from other websites are not allowed"

    if path not in PUBLIC_PATHS and not key_is_valid(headers.get("x-api-key")):
        return 401, "Missing or wrong API key"

    if method in WRITE_METHODS:
        if not write_limiter.allow():
            return 429, "Too many changes in a minute, slow down"
        has_body = int(headers.get("content-length") or 0) > 0 or "transfer-encoding" in headers
        media_type = headers.get("content-type", "").split(";")[0].strip().lower()
        if has_body and media_type != "application/json":
            # HTML forms on other sites can only send form data, never JSON.
            return 415, "Send JSON (Content-Type: application/json)"
        if int(headers.get("content-length") or 0) > MAX_BODY_BYTES:
            return 413, "Request body is too large (max 1 MB)"
    return None


class SecurityMiddleware:
    """A plain ASGI middleware: Starlette calls it with every request.
    scope describes the request, receive() gives its body in pieces, send() sends the response."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        method = scope["method"]
        problem = check_request(method, scope["path"], Headers(scope=scope))
        if problem:
            status, message = problem
            return await JSONResponse({"error": message}, status_code=status)(scope, receive, send)

        if method in WRITE_METHODS:
            # Read the body here, counting bytes, so a body without a Content-Length
            # (sent in chunks) can't get past the 1 MB limit either.
            body = b""
            while True:
                message = await receive()
                if message["type"] != "http.request":
                    return  # the client hung up
                body += message.get("body", b"")
                if len(body) > MAX_BODY_BYTES:
                    response = JSONResponse({"error": "Request body is too large (max 1 MB)"}, status_code=413)
                    return await response(scope, receive, send)
                if not message.get("more_body"):
                    break

            sent = False

            async def replay():
                # Hand the endpoint the body we already read, in one piece.
                nonlocal sent
                if not sent:
                    sent = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            return await self.app(scope, replay, send)

        await self.app(scope, receive, send)
