import WeekActions from './WeekActions'

const arrowButton =
  'px-3 py-2 rounded-lg text-teal-600 font-medium transition-[background-color,transform] duration-150 active:scale-95 disabled:active:scale-100 disabled:text-slate-300 disabled:cursor-not-allowed hover:bg-slate-50'

// Props are the values a component receives from its parent (here: Tracker.jsx).
// This component displays the week (title, dates, goal) and calls the on... functions when clicked.
function WeekSelector({ week, onPrev, onNext, hasPrev, hasNext, onUntickWeek, canUntick }) {
  return (
    <div className="mb-6 bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <button onClick={onPrev} disabled={!hasPrev} className={arrowButton}>← Prev</button>
        <div className="text-center px-2">
          <h2 className="font-semibold text-slate-800">{week.title}</h2>
          <p className="text-sm text-slate-400">{week.start} to {week.end}</p>
        </div>
        <button onClick={onNext} disabled={!hasNext} className={arrowButton}>Next →</button>
      </div>
      {week.goal && <p className="text-sm text-slate-600 text-center mt-2 italic">Goal: {week.goal}</p>}
      <div className="flex justify-center flex-wrap gap-1 mt-2">
        <WeekActions week={week} />
        {canUntick && (
          <button
            onClick={onUntickWeek}
            className="text-xs font-medium text-slate-500 hover:text-teal-600 hover:bg-slate-50 rounded-full px-3 py-1 transition active:scale-95"
          >
            Untick week
          </button>
        )}
      </div>
    </div>
  )
}

export default WeekSelector
