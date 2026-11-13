import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import MonthActions from './MonthActions'
import MonthCard from './MonthCard'
import RescheduleDialog from './RescheduleDialog'
import StatsSection from './StatsSection'

// The Months view: a Reschedule button, one card per month, then an "Add next month" card.
// The callbacks come from Tracker.
function MonthsView({ today, onPickDate, onOpenWeek, onAddMonth }) {
  const { plan } = usePlanActions()
  const [rescheduling, setRescheduling] = useState(false)

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold text-slate-800 text-center mb-2">Months</h1>
      <div className="text-center mb-5">
        <button
          onClick={() => setRescheduling(true)}
          className="text-sm font-medium text-teal-600 bg-white rounded-full px-4 py-1.5 shadow-sm hover:shadow active:scale-95 transition"
        >
          ⇥ Reschedule
        </button>
      </div>
      {rescheduling && <RescheduleDialog today={today} onClose={() => setRescheduling(false)} />}
      {plan.months.map((month, i) => (
        <MonthCard key={month.id} month={month} today={today} index={i} onPickDate={onPickDate} onOpenWeek={onOpenWeek}>
          <MonthActions month={month} />
        </MonthCard>
      ))}
      <button
        onClick={onAddMonth}
        className="animate-fade-up w-full rounded-xl border-2 border-dashed border-teal-400 text-teal-600 font-medium py-8 hover:bg-white transition active:scale-[0.99]"
      >
        + Add next month
      </button>
      <StatsSection today={today} />
    </div>
  )
}

export default MonthsView
