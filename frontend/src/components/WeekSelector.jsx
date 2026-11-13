// Props are the values a component receives from its parent (here: App.jsx).
// This component just displays them and calls onPrev/onNext when clicked.
function WeekSelector({ week, onPrev, onNext, hasPrev, hasNext }) {
  return (
    <div className="flex items-center justify-between mb-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="px-3 py-2 rounded text-teal-600 dark:text-teal-400 font-medium disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed hover:bg-teal-50 dark:hover:bg-slate-700"
      >
        ← Prev
      </button>
      <div className="text-center">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">{week.title}</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">{week.start} to {week.end}</p>
      </div>
      <button
        onClick={onNext}
        disabled={!hasNext}
        className="px-3 py-2 rounded text-teal-600 dark:text-teal-400 font-medium disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed hover:bg-teal-50 dark:hover:bg-slate-700"
      >
        Next →
      </button>
    </div>
  )
}

export default WeekSelector
