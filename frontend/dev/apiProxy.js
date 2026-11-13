// The /api proxy: the browser talks only to the Vite dev server (same origin, no CORS),
// and Vite passes /api requests on to the FastAPI backend, adding the API key.
// This runs in Node, not in the browser, so the key never reaches the page.

const BACKEND = 'http://127.0.0.1:8000'
const APP_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

// The proxy adds the key to whatever it forwards, so it must first refuse requests
// made by other websites open in the same browser:
// - no Origin header is fine (same-origin GETs often don't send one),
// - any other Origin than this app is refused,
// - Sec-Fetch-Site: cross-site (set by the browser, pages can't fake it) is refused.
function isFromAnotherSite(req) {
  const origin = req.headers.origin
  return (origin !== undefined && !APP_ORIGINS.has(origin)) || req.headers['sec-fetch-site'] === 'cross-site'
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

// A Vite plugin. configureServer adds our check in front of Vite's own handlers,
// so it runs before the proxy.
export function apiGuard() {
  return {
    name: 'plan-tracker-api-guard',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        if (isFromAnotherSite(req)) return sendJson(res, 403, { error: 'Requests from other websites are not allowed' })
        next()
      })
    },
  }
}

// Vite's server.proxy settings for /api.
export function apiProxy(apiKey) {
  return {
    '/api': {
      target: BACKEND,
      headers: { 'X-API-Key': apiKey }, // replaces any X-API-Key the browser might send
      // configure gets the underlying proxy; 'error' fires when the backend can't be reached.
      configure(proxy) {
        proxy.on('error', (err, req, res) => {
          if (!res.headersSent && !res.writableEnded && typeof res.setHeader === 'function') {
            sendJson(res, 503, { error: "Backend isn't running. Start it with .\\start-dev.ps1 in the project folder." })
          }
        })
      },
    },
  }
}
