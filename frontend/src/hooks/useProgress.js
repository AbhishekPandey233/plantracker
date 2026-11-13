import { useCallback, useState } from 'react'

const STORAGE_KEY = 'planTracker:ticks'

// Reads saved ticks from the browser once, when the hook first runs.
function loadTicks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

// Custom hook: keeps track of which task ids are ticked, and saves them
// to localStorage so they survive a page refresh. Any component can call
// useProgress() to read and change the same ticks.
export function useProgress() {
  // useState holds the ticks in memory; loadTicks only runs once (on mount).
  const [ticks, setTicks] = useState(loadTicks)

  // useCallback keeps this the same function between renders, so it's safe
  // to pass down as a prop without causing extra re-renders.
  const toggle = useCallback((id) => {
    setTicks((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isDone = useCallback((id) => Boolean(ticks[id]), [ticks])

  return { isDone, toggle }
}
