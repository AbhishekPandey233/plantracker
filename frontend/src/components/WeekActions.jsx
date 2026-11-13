import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { deleteMessage, deleteWeek, taskIdsIn, updateWeek } from '../utils/planEdit'
import PlanDialog from './PlanDialog'

const actionButton = 'text-xs font-medium text-slate-500 hover:text-teal-600 hover:bg-slate-50 rounded-full px-3 py-1 transition active:scale-95'

// Edit (title and goal) and Delete buttons for the week shown in the Weeks view.
function WeekActions({ week }) {
  const { plan, isDone } = usePlanActions()
  const [dialog, setDialog] = useState(null) // 'edit', 'delete' or null

  return (
    <>
      <button className={actionButton} onClick={() => setDialog('edit')}>Edit week</button>
      <button className={`${actionButton} hover:text-red-600`} onClick={() => setDialog('delete')}>Delete week</button>

      {dialog === 'edit' && (
        <PlanDialog
          title="Edit week"
          fields={[
            { name: 'title', label: 'Title' },
            { name: 'goal', label: 'Goal' },
          ]}
          initial={{ title: week.title, goal: week.goal ?? '' }}
          makePlan={(values) => updateWeek(plan, week.id, values)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <PlanDialog
          title={`Delete "${week.title}"?`}
          message={deleteMessage('This week', taskIdsIn(week), isDone)}
          confirmLabel="Delete week"
          danger
          makePlan={() => deleteWeek(plan, week.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}

export default WeekActions
