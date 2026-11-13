import { useEffect } from 'react'

// The "Ticked · Undo" message at the bottom of the screen. Closes itself after 5 seconds.
// "toast" is { message, id }; a new id (a new change) restarts the 5 seconds.
function Toast({ toast, onUndo, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null
  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div
        key={toast.id}
        role="status"
        className="animate-fade-up pointer-events-auto flex items-center gap-4 bg-slate-800 text-white text-sm rounded-full pl-5 pr-2 py-2 shadow-lg"
      >
        <span>{toast.message}</span>
        <button onClick={onUndo} className="rounded-full px-3 py-1 font-semibold text-teal-400 hover:bg-slate-700 active:scale-95 transition">
          Undo
        </button>
      </div>
    </div>
  )
}

export default Toast
