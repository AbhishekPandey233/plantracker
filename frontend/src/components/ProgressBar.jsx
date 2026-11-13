// A labelled bar showing done/total as a filled fraction. Pure props in,
// nothing to tick here — the tasks themselves live in TaskRow.
function ProgressBar({ label, done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-1">
        <span>{label}</span>
        <span>{done}/{total}</span>
      </div>
      {/* The fill is always full width and shrunk with scaleX, so it slides smoothly
          when a task is ticked (scale animates smoother than width). */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-teal-600 dark:bg-teal-400 h-2 rounded-full origin-left transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
