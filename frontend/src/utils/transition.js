import { flushSync } from 'react-dom'

// The entrance animations from index.css (animate-fade-up and animate-pop).
const ENTRANCES = new Set(['rise', 'grow', 'fade-in'])

// Runs a state change as an animated page transition (the View Transitions API).
// dir: 1 = forward (new page slides in from the right), -1 = back (from the left).
export function withTransition(update, dir) {
  // Older browsers without View Transitions just switch instantly.
  if (!document.startViewTransition) return update()
  document.documentElement.style.setProperty('--dir', dir)
  // flushSync makes React update the page right now (normally it waits a little),
  // so the browser can take its "after" picture straight away.
  const transition = document.startViewTransition(() => {
    flushSync(update)
    // The new page's cards would also rise in while the page slides. Measured: either
    // motion alone is smooth, but both together make the browser re-capture the sliding
    // page on every frame (frames of 50-75ms instead of 33ms). So when a page slides in,
    // its cards start in their final place and the slide is the motion.
    for (const animation of document.getAnimations()) {
      if (ENTRANCES.has(animation.animationName)) animation.finish()
    }
  })
  // Clicking again mid-slide cancels the old animation (the state change still happens).
  // The browser reports that as an error unless we say we expected it.
  transition.ready.catch(() => {})
}
