import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { moveTask, deleteTask } from '../utils/planEdit'
import { isCustomTask } from '../utils/timeHelpers'

// One colour per task type: text for the label, border for the left edge.
const TYPE_STYLES = {
  learn: { text: 'text-blue-600', border: 'border-blue-400' },
  practise: { text: 'text-emerald-600', border: 'border-emerald-400' },
  project: { text: 'text-purple-600', border: 'border-purple-400' },
  review: { text: 'text-amber-600', border: 'border-amber-400' },
  french: { text: 'text-rose-600', border: 'border-rose-400' },
  personal: { text: 'text-cyan-700', border: 'border-cyan-500' },
}
const DEFAULT_STYLE = { text: 'text-slate-600', border: 'border-slate-300' }

const linkButton = 'text-xs font-medium text-slate-500 hover:text-teal-600 px-1 rounded transition-colors'

// A single task row: checkbox, type label, time, text, resources, and the
// Move / Edit / Delete actions (shown on hover).
// "task" and "date" are props from the parent; the tick state and actions come
// from PlanContext (see PlanContext.js), so they don't have to be passed down.
// "large" makes today's tasks bigger and easier to tap.
function TaskRow({ task, date, large = false }) {
  const { plan, savePlan, isDone, toggle, openTaskForm } = usePlanActions()
  // Local state: which inline panel is open ('move', 'delete' or null), and any save error.
  const [panel, setPanel] = useState(null)
  const [moveDate, setMoveDate] = useState(date)
  const [error, setError] = useState(null)

  const style = TYPE_STYLES[task.type] ?? DEFAULT_STYLE
  const done = isDone(task.id)
  const mine = isCustomTask(task)

  // Runs a plan change, saves it, and shows the server's error if it refuses.
  async function save(change) {
    setError(null)
    try {
      await savePlan(change(plan))
      setPanel(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={`group pl-3 border-l-4 ${style.border} rounded-r-lg transition-[opacity,background-color] duration-200 hover:bg-slate-50 ${done ? 'opacity-50' : ''}`}>
      <label className={`flex items-start gap-3 ${large ? 'pt-3' : 'pt-2'} cursor-pointer`}>
        <input
          type="checkbox"
          checked={done}
          // onChange fires when the checkbox is clicked; the hook saves the new tick.
          onChange={() => toggle(task.id)}
          className={`mt-1 accent-teal-600 cursor-pointer transition-transform duration-150 active:scale-75 ${large ? 'h-6 w-6' : 'h-5 w-5'}`}
        />
        <div className={done ? 'line-through' : ''}>
          <span className={`text-xs font-semibold uppercase ${style.text}`}>{task.type}</span>
          {mine && <span className="ml-2 text-[10px] font-semibold uppercase bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">mine</span>}
          {task.time && <span className="text-xs text-slate-400 ml-2">{task.time}</span>}
          <p className={large ? 'text-base text-slate-700' : 'text-sm text-slate-700'}>{task.text}</p>
          {task.resources && <p className="text-xs text-slate-400">{task.resources}</p>}
        </div>
      </label>

      {/* Actions: faint until the row is hovered or a button inside it has focus. */}
      <div className={`flex flex-wrap items-center gap-1 ${large ? 'pb-3' : 'pb-2'} pl-8 transition-opacity duration-150 ${panel ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
        {panel === null && (
          <>
            <button className={linkButton} onClick={() => setPanel('move')}>Move</button>
            {mine && <button className={linkButton} onClick={() => openTaskForm({ mode: 'edit', task, date })}>Edit</button>}
            {mine && <button className={linkButton} onClick={() => setPanel('delete')}>Delete</button>}
          </>
        )}

        {panel === 'move' && (
          <form
            className="flex flex-wrap items-center gap-2 animate-fade-up"
            onSubmit={(e) => {
              e.preventDefault() // stop the browser from reloading the page on submit
              save((p) => moveTask(p, task.id, moveDate))
            }}
          >
            <span className="text-xs text-slate-500">Move to</span>
            <input type="date" required value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className="text-xs border border-slate-300 rounded px-2 py-1" />
            <button type="submit" className="text-xs font-semibold text-white bg-teal-600 rounded px-2 py-1 active:scale-95 transition">Move</button>
            <button type="button" className={linkButton} onClick={() => setPanel(null)}>Cancel</button>
          </form>
        )}

        {panel === 'delete' && (
          <div className="flex items-center gap-2 animate-fade-up">
            <span className="text-xs text-slate-600">Delete this task?</span>
            <button className="text-xs font-semibold text-white bg-red-600 rounded px-2 py-1 active:scale-95 transition" onClick={() => save((p) => deleteTask(p, task.id))}>
              Delete
            </button>
            <button className={linkButton} onClick={() => setPanel(null)}>Cancel</button>
          </div>
        )}

        {error && <p className="w-full text-xs text-red-600 whitespace-pre-line">{error}</p>}
      </div>
    </div>
  )
}

export default TaskRow
