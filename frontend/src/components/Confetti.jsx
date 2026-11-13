import { useState } from 'react'

const COLORS = ['#f97316', '#fb923c', '#16a34a', '#f59e0b', '#8b5e3c', '#ea580c']

// A confetti burst made of plain CSS animations (the "confetti" keyframes in index.css).
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
      {pieces.map((p, i) => (
        <span
          key={i}
          // The piece that ends last tells the parent the burst is over.
          onAnimationEnd={p.delay + p.duration === longest ? onDone : undefined}
          className={`absolute top-0 ${p.round ? 'h-2 w-2 rounded-full' : 'h-3 w-1.5 rounded-sm'}`}
          style={{
            left: `${p.left}%`,
            background: p.color,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
            animation: `confetti ${p.duration}ms cubic-bezier(0.2, 0.6, 0.4, 1) ${p.delay}ms both`,
          }}
        />
      ))}
    </div>
  )
}

export default Confetti
