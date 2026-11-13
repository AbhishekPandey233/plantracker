import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import Modal from './Modal'

const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500'

// A small dialog that changes the plan: an edit form ("fields") or a yes/no
// confirmation ("message", "danger"). makePlan(values) returns the new plan or
// throws an Error whose message is shown; the new plan is then saved to plan.json.
function PlanDialog({ title, fields = [], initial = {}, message, confirmLabel = 'Save', danger = false, makePlan, onClose }) {
  const { savePlan } = usePlanActions()
  const [values, setValues] = useState(initial)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault() // stop the browser's own form submit (a page reload)
    setError(null)
    setSaving(true)
    try {
      await savePlan(makePlan(values))
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {message && <p className="text-slate-700">{message}</p>}
        {fields.map((f, i) => (
          <div key={f.name}>
            <label className="block text-sm font-medium text-slate-600 mb-1" htmlFor={`pd-${f.name}`}>{f.label}</label>
            <input
              id={`pd-${f.name}`}
              type={f.type ?? 'text'}
              className={input}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              autoFocus={i === 0}
            />
          </div>
        ))}
        {error && <p className="rounded-lg bg-amber-100 text-amber-800 text-sm px-3 py-2 whitespace-pre-line">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 px-4 py-2 hover:text-slate-800">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            autoFocus={!fields.length}
            className={`text-sm font-semibold text-white rounded-full px-4 py-2 active:scale-95 transition disabled:opacity-40 ${danger ? 'bg-red-600' : 'bg-teal-600'}`}
          >
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default PlanDialog
