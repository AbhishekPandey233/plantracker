import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { api } from '../utils/api'
import { deleteMessage } from '../utils/planHelpers'
import PlanDialog from './PlanDialog'

const actionButton = 'text-xs font-medium text-slate-500 hover:text-teal-600 hover:bg-slate-50 rounded-full px-3 py-1 transition active:scale-95'

// Edit (title and goal) and Delete buttons for the week shown in the Weeks view.
function WeekActions({ week }) {
  const { editPlan } = usePlanActions()
  const [dialog, setDialog] = useState(null) // 'edit', or { counts } for delete, or null
  const [error, setError] = useState(null)
  const url = `/api/weeks/${encodeURIComponent(week.id)}`

  // Asks the server first how many tasks and ticks deleting would remove (dry run).
  async function askDelete() {
    setError(null)
    try {
      setDialog({ counts: await api(`${url}?dry_run=true`, { method: 'DELETE' }) })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <button className={actionButton} onClick={() => setDialog('edit')}>Edit week</button>
      <button className={`${actionButton} hover:text-red-600`} onClick={askDelete}>Delete week</button>
      {error && <span className="text-xs text-amber-800">{error}</span>}

      {dialog === 'edit' && (
        <PlanDialog
          title="Edit week"
          fields={[
            { name: 'title', label: 'Title' },
            { name: 'goal', label: 'Goal' },
          ]}
          initial={{ title: week.title, goal: week.goal ?? '' }}
          onSave={(values) => editPlan(url, { method: 'PATCH', body: values })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.counts && (
        <PlanDialog
          title={`Delete "${week.title}"?`}
          message={deleteMessage('This week', dialog.counts)}
          confirmLabel="Delete week"
          danger
          onSave={() => editPlan(url, { method: 'DELETE' })}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}

export default WeekActions
