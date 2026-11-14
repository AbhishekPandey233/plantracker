import { useEffect, useState } from 'react'

// Custom hook: counts a number up from 0 to "target" over "duration" ms (for the Home page).
// requestAnimationFrame runs the step once per screen frame; the cleanup cancels it if
// the component goes away (or the target changes) halfway.
export function useCountUp(target, duration) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const step = (time) => {
      const p = Math.min(1, (time - start) / duration)
      setValue(Math.round(target * (1 - (1 - p) ** 3))) // ease-out: fast first, slows at the end
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}
