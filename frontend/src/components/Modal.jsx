import { useEffect } from 'react'

// A centred box over a dimmed page. Escape or a click on the dimmed area closes it.
function Modal({ title, onClose, children }) {
  // useEffect: listen for Escape while the modal is open, and stop listening when it closes.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-pop bg-white rounded-xl shadow-xl p-5 w-full max-w-lg my-12">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export default Modal
