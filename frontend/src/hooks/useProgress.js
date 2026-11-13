import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../utils/api'
import { mergeTicks } from '../utils/planHelpers'

const STORAGE_KEY = 'planTracker:ticks' // the browser's backup copy of the ticks
const MIGRATED_KEY = 'planTracker:migratedToFile' // set once old browser ticks are in progress.json
const SAVE_DELAY_MS = 500

// Reads the browser's copy of the ticks.
function loadLocalTicks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

function saveLocalTicks(ticks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ticks))
  } catch {
    // Browser storage full or blocked: progress.json still has the ticks.
  }
}

// Custom hook: keeps track of which task ids are ticked.
// The real copy lives in frontend/data/progress.json (through the local data API),
// and a backup copy stays in the browser's localStorage in case the API fails.
// Returns { isDone, toggle, saveError }.
export function useProgress() {
  // useState holds the ticks in memory. Start with the browser's copy so ticks
  // show instantly, then swap in progress.json once it has loaded.
  const [ticks, setTicks] = useState(loadLocalTicks)
  const [saveError, setSaveError] = useState(null)

  // useRef keeps a value between renders without causing a re-render.
  const fileLoaded = useRef(false) // never write the file before reading it, or we'd overwrite it
  const unsaved = useRef(null) // the latest ticks still waiting to be written
  const timer = useRef(null)

  // Writes any unsaved ticks to progress.json right now.
  const flush = useCallback((keepalive = false) => {
    clearTimeout(timer.current)
    const data = unsaved.current
    if (!data || !fileLoaded.current) return Promise.resolve()
    unsaved.current = null
    return api('/api/progress', data, { keepalive })
      .then(() => setSaveError(null))
      .catch((err) => {
        unsaved.current ??= data // keep it, so the next change or page close tries again
        setSaveError(`Ticks are only saved in this browser for now: ${err.message}`)
      })
  }, [])

  // useEffect with [flush] runs once on start (flush never changes).
  useEffect(() => {
    api('/api/progress')
      .then((fileTicks) => {
        let next = fileTicks
        const migrated = localStorage.getItem(MIGRATED_KEY)
        if (!migrated) {
          // One-time move: ticks from before Build Plan 2 lived only in the browser.
          // Merge them in (a tick on either side stays ticked). The browser copy is kept.
          next = mergeTicks(fileTicks, loadLocalTicks())
          unsaved.current = next
        }
        fileLoaded.current = true
        setTicks(next)
        saveLocalTicks(next)
        if (!migrated) {
          flush().then(() => {
            if (!unsaved.current) localStorage.setItem(MIGRATED_KEY, 'yes') // only once the save worked
          })
        }
      })
      .catch((err) => setSaveError(`Couldn't load progress.json, showing the ticks saved in this browser: ${err.message}`))

    // Closing or refreshing the tab within half a second of a tick: send it now.
    const onPageHide = () => flush(true)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      flush()
    }
  }, [flush])

  // Saves new ticks: to the browser now, and to the file half a second after the last change.
  const commit = useCallback(
    (next) => {
      saveLocalTicks(next)
      unsaved.current = next
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush],
  )

  // Every change goes through here, so it can be undone. makeNext gets the current
  // ticks and returns the new ones; message is shown in the Undo toast.
  const previous = useRef(null) // the ticks before the last change, for Undo
  const [toast, setToast] = useState(null) // { message, id } or null
  const change = useCallback(
    (makeNext, message) => {
      setTicks((prev) => {
        const next = makeNext(prev)
        previous.current = prev
        commit(next)
        return next
      })
      setToast({ message, id: Date.now() }) // a new id restarts the toast's 5-second timer
    },
    [commit],
  )

  // useCallback keeps these the same functions between renders (until something in
  // their [ ] list changes), so they're safe to pass down without extra re-renders.
  const toggle = useCallback(
    (id) => change((prev) => ({ ...prev, [id]: !prev[id] }), ticks[id] ? 'Unticked' : 'Ticked'),
    [change, ticks],
  )

  // Ticks (value true) or unticks (false) many ids at once, e.g. a whole day or week.
  const setMany = useCallback(
    (ids, value, message) =>
      change((prev) => {
        const next = { ...prev }
        for (const id of ids) next[id] = value
        return next
      }, message),
    [change],
  )

  const resetAll = useCallback(() => change(() => ({}), 'All progress reset'), [change])

  // Puts back the ticks from before the last change.
  const undo = useCallback(() => {
    const restore = previous.current
    if (!restore) return
    previous.current = null
    setTicks(restore)
    commit(restore)
    setToast(null)
  }, [commit])

  const closeToast = useCallback(() => setToast(null), [])
  const isDone = useCallback((id) => Boolean(ticks[id]), [ticks])

  return { isDone, toggle, setMany, resetAll, undo, toast, closeToast, saveError }
}
