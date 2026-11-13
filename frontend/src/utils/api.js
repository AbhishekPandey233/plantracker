// Talks to the local data API in dev/dataApi.js.
// api('/api/plan') reads; api('/api/plan', data) saves (PUT).
// Throws an Error with a readable message if anything goes wrong.
export async function api(url, body, { keepalive = false } = {}) {
  const options =
    body === undefined
      ? undefined
      : {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive, // lets the save finish even while the tab is closing
        }

  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new Error('Could not reach the app server. Is npm run dev running?')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.errors?.join('\n') ?? data?.error ?? `Server error ${res.status}`)
  if (data === null) throw new Error(`${url} did not send JSON. Is npm run dev running?`)
  return data
}
