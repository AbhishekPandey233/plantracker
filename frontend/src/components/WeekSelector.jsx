// Props are the values a component receives from its parent (here: App.jsx).
// This component just displays them and calls onPrev/onNext when clicked.
function WeekSelector({ week, onPrev, onNext, hasPrev, hasNext }) {
  return (
    <div className="flex items-center justify-between mb-6 bg-white rounded-lg shadow p-4">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="px-3 py-2 rounded text-indigo-600 font-medium disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-indigo-50"
      >
        ← Prev
      </button>
      <div className="text-center">
        <h2 className="font-semibold text-slate-800">{week.title}</h2>
        <p className="text-sm text-slate-400">{week.start} to {week.end}</p>
      </div>
      <button
        onClick={onNext}
        disabled={!hasNext}
        className="px-3 py-2 rounded text-indigo-600 font-medium disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-indigo-50"
      >
        Next →
      </button>
    </div>
  )
}

export default WeekSelector
