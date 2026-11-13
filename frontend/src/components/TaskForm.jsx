import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { TASK_TYPES } from '../utils/validatePlan'
import Modal from './Modal'

const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500'
const fieldLabel = 'block text-xs font-semibold text-slate-500 uppercase mb-1'

// The Add task / Edit task form, in a modal.
// "form" is { mode: 'add', date } or { mode: 'edit', task, date }.
function TaskForm({ form, onClose }) {
  const { editPlan } = usePlanActions()
  const editing = form.mode === 'edit'
  // One state object for all the fields; each input updates its own key.
  const [fields, setFields] = useState({
    date: form.date,
    type: form.task?.type ?? 'learn',
    time: form.task?.time ?? '',
    text: form.task?.text ?? '',
    resources: form.task?.resources ?? '',
  })
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setFields({ ...fields, [key]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault() // stop the browser from reloading the page
    setErrors([])
    setSaving(true)
    try {
      // The server makes the id, finds or creates the day (and its week and month),
      // and moves the task when the date changed. It keeps the task's id either way.
      if (editing) await editPlan(`/api/tasks/${encodeURIComponent(form.task.id)}`, { method: 'PATCH', body: fields })
      else await editPlan('/api/tasks', { method: 'POST', body: fields })
      onClose()
    } catch (err) {
      setErrors(err.message.split('\n'))
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit task' : 'Add task'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={fieldLabel}>Date</span>
            <input type="date" required value={fields.date} onChange={set('date')} className={input} />
          </label>
          <label>
            <span className={fieldLabel}>Type</span>
            <select value={fields.type} onChange={set('type')} className={input}>
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={fieldLabel}>Time (optional)</span>
          <input value={fields.time} onChange={set('time')} placeholder="19:30-20:15 or Work hour" className={input} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Task</span>
          <input required autoFocus value={fields.text} onChange={set('text')} placeholder="What will you do?" className={input} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Resources (optional)</span>
          <input value={fields.resources} onChange={set('resources')} placeholder="Links, books, apps" className={input} />
        </label>

        {errors.length > 0 && (
          <ul className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2 list-disc list-inside">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-teal-600 text-white font-medium active:scale-95 transition disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save' : 'Add task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default TaskForm
