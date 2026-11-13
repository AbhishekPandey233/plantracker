// Talks to the backend (FastAPI) through the Vite dev server's /api proxy.
// The proxy adds the API key, so the browser never sees it (see vite.config.js).
//
//   api('/api/plan')                                   GET
//   api('/api/tasks', { method: 'POST', body: {...} }) any method, with a JSON body
//
// Returns the parsed JSON answer, or throws an Error with a readable message
// (the server's own message when it refuses something).
export async function api(url, { method = 'GET', body } = {}) {
  const options = { method }
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new Error("Can't reach the app server. Is npm run dev (or start-dev.ps1) running?")
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // The backend answers {"error": "...", "details": [...]} (details only for invalid input).
    const message = [data?.error, ...(data?.details ?? [])].filter(Boolean).join('\n')
    throw new Error(message || `Server error ${res.status}`)
  }
  return data
}

// Where to save one tick: routine ticks look like "routine-2026-11-18-wake".
export function tickUrl(id) {
  const routine = id.match(/^routine-(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)$/)
  return routine ? `/api/ticks/routine/${routine[1]}/${routine[2]}` : `/api/ticks/tasks/${encodeURIComponent(id)}`
}
