// One colour per task type, used for both the label text and the left border.
const TYPE_STYLES = {
  learn: 'text-blue-600 border-blue-400',
  practise: 'text-emerald-600 border-emerald-400',
  project: 'text-purple-600 border-purple-400',
  review: 'text-amber-600 border-amber-400',
}

// A single task row: checkbox, type label, time, text, resources.
// "done" and "onToggle" are passed down from App via DayCard (props).
function TaskRow({ task, done, onToggle }) {
  const style = TYPE_STYLES[task.type] ?? 'text-slate-600 border-slate-300'

  return (
    <label
      className={`flex items-start gap-3 py-2 pl-3 border-l-4 ${style.split(' ')[1]} ${done ? 'opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={done}
        // onChange fires when the checkbox is clicked; we tell App which task id changed.
        onChange={() => onToggle(task.id)}
        className="mt-1 h-5 w-5 accent-indigo-600"
      />
      <div className={done ? 'line-through' : ''}>
        <span className={`text-xs font-semibold uppercase ${style.split(' ')[0]}`}>
          {task.type}
        </span>
        {task.time && <span className="text-xs text-slate-400 ml-2">{task.time}</span>}
        <p className="text-sm text-slate-700">{task.text}</p>
        {task.resources && <p className="text-xs text-slate-400">{task.resources}</p>}
      </div>
    </label>
  )
}

export default TaskRow
