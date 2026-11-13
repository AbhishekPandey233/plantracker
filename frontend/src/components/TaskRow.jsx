// One colour per task type: text for the label, border for the left edge.
// Each has a light and dark variant so contrast holds in both modes.
const TYPE_STYLES = {
  learn: { text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-400 dark:border-blue-500' },
  practise: { text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-400 dark:border-emerald-500' },
  project: { text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-400 dark:border-purple-500' },
  review: { text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-400 dark:border-amber-500' },
}
const DEFAULT_STYLE = { text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600' }

// A single task row: checkbox, type label, time, text, resources.
// "done" and "onToggle" are passed down from App via DayCard (props).
// "large" makes today's tasks bigger and easier to tap (Phase 5 Today view).
function TaskRow({ task, done, onToggle, large = false }) {
  const style = TYPE_STYLES[task.type] ?? DEFAULT_STYLE

  return (
    <label
      className={`flex items-start gap-3 ${large ? 'py-3' : 'py-2'} pl-3 border-l-4 ${style.border} cursor-pointer rounded-r-lg transition-[opacity,background-color] duration-200 hover:bg-slate-50 ${done ? 'opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={done}
        // onChange fires when the checkbox is clicked; we tell App which task id changed.
        onChange={() => onToggle(task.id)}
        className={`mt-1 accent-teal-600 dark:accent-teal-400 cursor-pointer transition-transform duration-150 active:scale-75 ${large ? 'h-6 w-6' : 'h-5 w-5'}`}
      />
      {/* ponytail: plain line-through; fading text-decoration-color was unreliable in Chrome.
          The row's opacity fade (on the label above) is the "done" animation. */}
      <div className={done ? 'line-through' : ''}>
        <span className={`text-xs font-semibold uppercase ${style.text}`}>
          {task.type}
        </span>
        {task.time && <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{task.time}</span>}
        <p className={large ? 'text-base text-slate-700 dark:text-slate-200' : 'text-sm text-slate-700 dark:text-slate-200'}>
          {task.text}
        </p>
        {task.resources && <p className="text-xs text-slate-400 dark:text-slate-500">{task.resources}</p>}
      </div>
    </label>
  )
}

export default TaskRow
