import { useEffect, useRef, useState } from 'react'

const item = 'block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors'

// The small gear menu in the top-right corner: Import from Claude, Settings (export/import backup), Reset all progress.
// Reset asks "Are you sure?" inside the menu before doing anything.
function Menu({ onImport, onSettings, onResetAll }) {
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
        aria-label="Settings menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="h-9 w-9 grid place-items-center rounded-full text-slate-500 hover:bg-slate-200 transition active:scale-95"
      >
        {/* Gear icon (inline SVG, Heroicons "cog-6-tooth"); stroke="currentColor" uses the text colour. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
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
          <button
            className={item}
            onClick={() => {
              setOpen(false)
              onSettings()
            }}
          >
            Settings (export, backup)
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
