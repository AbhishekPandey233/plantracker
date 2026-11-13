import { useEffect, useState } from 'react'
import { currentMoment } from '../utils/timeHelpers'

// Custom hook: the current time, updated every 30 seconds so the clock and the
// "Now" highlight move on by themselves.
export function useNow() {
  const [now, setNow] = useState(currentMoment)

  // useEffect starts a timer when the component appears; the function it returns
  // (the "cleanup") stops the timer when the component goes away.
  useEffect(() => {
    const timer = setInterval(() => setNow(currentMoment()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return now
}
