import { useState } from 'react'

const COLORS = ['#f97316', '#fb923c', '#16a34a', '#f59e0b', '#8b5e3c', '#ea580c']

// A confetti burst made of plain CSS animations (the confetti-* keyframes in index.css).
// "big" (a whole week done) throws more pieces for longer. Calls onDone when finished.
function Confetti({ big, onDone }) {
  // useState with a function: the random pieces are made once, not on every render.
  const [pieces] = useState(() =>
    Array.from({ length: big ? 90 : 35 }, () => ({
      left: 50 + (Math.random() - 0.5) * (big ? 90 : 40), // % from the left, spread around the middle
      dx: (Math.random() - 0.5) * 300, // sideways drift in px
      rot: (Math.random() - 0.5) * 1080, // degrees of spin
      delay: Math.random() * (big ? 400 : 150),
      duration: (big ? 2600 : 1900) + Math.random() * 700,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.3,
    })),
  )
  const longest = Math.max(...pieces.map((p) => p.delay + p.duration))

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" aria-hidden="true">
      {pieces.map((p, i) => {
        const timing = `${p.duration}ms ${p.delay}ms both`
        return (
          // Outer piece: falls, sways and fades. Inner piece: spins. Separate elements,
          // so each motion is one smooth animation (see index.css).
          <span
            key={i}
            className="absolute top-0"
            // The piece that ends last tells the parent the burst is over. Events from
            // the inner spin bubble up here too, so only the fade counts.
            onAnimationEnd={p.delay + p.duration === longest ? (e) => e.animationName === 'confetti-fade' && onDone() : undefined}
            style={{
              left: `${p.left}%`,
              '--dx': `${p.dx}px`,
              animation: `confetti-fall ${timing} cubic-bezier(0.2, 0.6, 0.4, 1), confetti-sway ${timing} ease-in-out, confetti-fade ${timing} linear`,
            }}
          >
            <span
              className={`block ${p.round ? 'h-2 w-2 rounded-full' : 'h-3 w-1.5 rounded-sm'}`}
              style={{ background: p.color, '--rot': `${p.rot}deg`, animation: `confetti-spin ${timing} linear` }}
            />
          </span>
        )
      })}
    </div>
  )
}

export default Confetti
