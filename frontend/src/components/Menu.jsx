import { useEffect, useRef, useState } from 'react'

const item = 'block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors'

// The small "⋯" menu in the top-right corner: Import from Claude, Reset all progress.
// Reset asks "Are you sure?" inside the menu before doing anything.
function Menu({ onImport, onResetAll }) {
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const ref = useRef(null) // the menu's outer element, to detect clicks outside it

  // Close the menu when clicking anywhere else or pressing Escape.
  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      setConfirmReset(false)
    }
    const onClick = (e) => !ref.current?.contains(e.target) && close()
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-200 text-xl leading-none transition active:scale-95"
      >
        ⋯
      </button>
      {open && (
        <div className="animate-pop origin-top-right absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg py-1 z-30">
          <button
            className={item}
            onClick={() => {
              setOpen(false)
              onImport()
            }}
          >
            Import from Claude
          </button>
          {!confirmReset ? (
            <button className={`${item} text-red-600`} onClick={() => setConfirmReset(true)}>
              Reset all progress
            </button>
          ) : (
            <div className="px-4 py-2 animate-fade-up">
              <p className="text-sm text-slate-700">Untick every task and routine block?</p>
              <div className="flex gap-2 mt-2">
                <button
                  className="text-xs font-semibold text-white bg-red-600 rounded px-2 py-1 active:scale-95 transition"
                  onClick={() => {
                    setOpen(false)
                    setConfirmReset(false)
                    onResetAll()
                  }}
                >
                  Yes, reset
                </button>
                <button className="text-xs text-slate-500 px-2 py-1 hover:text-slate-800" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Menu
