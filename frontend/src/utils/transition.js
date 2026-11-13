import { flushSync } from 'react-dom'

// Runs a state change as an animated page transition (the View Transitions API).
// dir: 1 = forward (new page slides in from the right), -1 = back (from the left).
export function withTransition(update, dir) {
  // Older browsers without View Transitions just switch instantly.
  if (!document.startViewTransition) return update()
  document.documentElement.style.setProperty('--dir', dir)
  // flushSync makes React update the page right now (normally it waits a little),
  // so the browser can take its "after" picture straight away.
  const transition = document.startViewTransition(() => flushSync(update))
  // Clicking again mid-slide cancels the old animation (the state change still happens).
  // The browser reports that as an error unless we say we expected it.
  transition.ready.catch(() => {})
}
