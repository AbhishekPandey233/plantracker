import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { api } from '../utils/api'
import { deleteMessage } from '../utils/planHelpers'
import PlanDialog from './PlanDialog'

const actionButton = 'text-xs font-medium text-slate-500 hover:text-teal-600 hover:bg-slate-50 rounded-full px-2 py-1 transition active:scale-95'

// Edit / + Week / Delete buttons on a Months view card.
function MonthActions({ month }) {
  const { editPlan } = usePlanActions()
  const [dialog, setDialog] = useState(null) // 'edit', or { counts } for delete, or null
  const [error, setError] = useState(null)
  const url = `/api/months/${encodeURIComponent(month.id)}`

  // Runs an action and shows the server's message if it refuses.
  async function attempt(action) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
  }

  // Asks the server first how many tasks and ticks deleting would remove (dry run).
  const askDelete = () => attempt(async () => setDialog({ counts: await api(`${url}?dry_run=true`, { method: 'DELETE' }) }))

  return (
    <div className="text-right shrink-0">
      <div className="flex gap-1">
        <button className={actionButton} onClick={() => setDialog('edit')}>Edit</button>
        <button className={actionButton} onClick={() => attempt(() => editPlan(`${url}/weeks`, { method: 'POST' }))}>+ Week</button>
        <button className={`${actionButton} hover:text-red-600`} onClick={askDelete}>Delete</button>
      </div>
      {error && <p className="animate-fade-up text-xs text-amber-800 max-w-56 mt-1 whitespace-pre-line">{error}</p>}

      {dialog === 'edit' && (
        <PlanDialog
          title="Edit month"
          fields={[
            { name: 'title', label: 'Title' },
            { name: 'start', label: 'Start date', type: 'date' },
            { name: 'end', label: 'End date', type: 'date' },
          ]}
          initial={{ title: month.title, start: month.start, end: month.end }}
          onSave={(values) => editPlan(url, { method: 'PATCH', body: values })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.counts && (
        <PlanDialog
          title={`Delete "${month.title}"?`}
          message={deleteMessage('This month', dialog.counts)}
          confirmLabel="Delete month"
          danger
          onSave={() => editPlan(url, { method: 'DELETE' })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

export default MonthActions
