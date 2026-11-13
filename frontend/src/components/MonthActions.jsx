import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { addWeek, deleteMessage, deleteMonth, taskIdsIn, updateMonth } from '../utils/planEdit'
import PlanDialog from './PlanDialog'

const actionButton = 'text-xs font-medium text-slate-500 hover:text-teal-600 hover:bg-slate-50 rounded-full px-2 py-1 transition active:scale-95'

// Edit / + Week / Delete buttons on a Months view card.
function MonthActions({ month }) {
  const { plan, savePlan, isDone } = usePlanActions()
  const [dialog, setDialog] = useState(null) // 'edit', 'delete' or null
  const [error, setError] = useState(null)

  async function addOneWeek() {
    setError(null)
    try {
      await savePlan(addWeek(plan, month.id).plan)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="text-right shrink-0">
      <div className="flex gap-1">
        <button className={actionButton} onClick={() => setDialog('edit')}>Edit</button>
        <button className={actionButton} onClick={addOneWeek}>+ Week</button>
        <button className={`${actionButton} hover:text-red-600`} onClick={() => setDialog('delete')}>Delete</button>
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
          makePlan={(values) => updateMonth(plan, month.id, values)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <PlanDialog
          title={`Delete "${month.title}"?`}
          message={deleteMessage('This month', taskIdsIn(month), isDone)}
          confirmLabel="Delete month"
          danger
          makePlan={() => deleteMonth(plan, month.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

export default MonthActions
