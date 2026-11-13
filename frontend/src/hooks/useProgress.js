import { useCallback, useEffect, useRef, useState } from 'react'
import { api, tickUrl } from '../utils/api'

// Custom hook: which tasks and routine blocks are ticked, saved in the backend.
// A tick shows at once ("optimistic"), then is sent to the server. If the server
// refuses, the real ticks are loaded again and the problem is shown.
// Returns { isDone, toggle, setMany, resetAll, undo, reload, toast, closeToast, saveError }.
export function useProgress() {
  // useState holds the ticks for rendering: { "<tick id>": true/false }.
  const [ticks, setTicks] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [toast, setToast] = useState(null) // { message, id } or null

  // useRef keeps a value between renders without causing a re-render.
  const latest = useRef({}) // the newest ticks, even before React has re-rendered (fast clicks)
  const previous = useRef(null) // the ticks before the last change, for Undo
  const queue = useRef(Promise.resolve()) // saves wait for each other, so they arrive in order

  const show = useCallback((next) => {
    latest.current = next
    setTicks(next)
  }, [])

  const reload = useCallback(() => api('/api/progress').then(show), [show])

  // useEffect with [reload] runs once on start.
  useEffect(() => {
    reload().catch((err) => setSaveError(`Couldn't load your ticks: ${err.message}`))
  }, [reload])

  // Queues one save. A tick then an untick of the same task must reach the server in
  // that order, so each request waits for the one before it.
  const send = useCallback(
    (request) => {
      queue.current = queue.current.then(request).then(
        () => setSaveError(null),
        (err) => {
          setSaveError(`That change wasn't saved: ${err.message}`)
          return reload().catch(() => {}) // show what the server really has
        },
      )
    },
    [reload],
  )

  // Shows `next` straight away and sends only the ids that changed.
  const change = useCallback(
    (next, message) => {
      const prev = latest.current
      const changed = Object.keys({ ...prev, ...next }).filter((id) => Boolean(prev[id]) !== Boolean(next[id]))
      if (!changed.length) return
      previous.current = prev
      show(next)
      if (changed.length === 1) {
        const [id] = changed
        send(() => api(tickUrl(id), { method: 'PUT', body: { done: Boolean(next[id]) } }))
      } else {
        send(() => api('/api/ticks', { method: 'PUT', body: { ticks: Object.fromEntries(changed.map((id) => [id, Boolean(next[id])])) } }))
      }
      if (message) setToast({ message, id: Date.now() }) // a new id restarts the toast's 5-second timer
    },
    [send, show],
  )

  // useCallback keeps these the same functions between renders, so they're safe to
  // pass down without extra re-renders.
  const toggle = useCallback(
    (id) => change({ ...latest.current, [id]: !latest.current[id] }, latest.current[id] ? 'Unticked' : 'Ticked'),
    [change],
  )

  // Ticks (value true) or unticks (false) many ids at once, e.g. a whole day or week.
  const setMany = useCallback(
    (ids, value, message) => change({ ...latest.current, ...Object.fromEntries(ids.map((id) => [id, value])) }, message),
    [change],
  )

  const resetAll = useCallback(() => {
    const allOff = Object.fromEntries(Object.keys(latest.current).map((id) => [id, false]))
    change(allOff, 'All progress reset')
  }, [change])

  // Puts back the ticks from before the last change (no toast, so it never celebrates).
  const undo = useCallback(() => {
    const restore = previous.current
    if (!restore) return
    change(restore)
    previous.current = null
    setToast(null)
  }, [change])

  const closeToast = useCallback(() => setToast(null), [])
  const isDone = useCallback((id) => Boolean(ticks[id]), [ticks])

  return { isDone, toggle, setMany, resetAll, undo, reload, toast, closeToast, saveError }
}
