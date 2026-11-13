import { usePlanActions } from '../PlanContext'
import MonthActions from './MonthActions'
import MonthCard from './MonthCard'
import StatsSection from './StatsSection'

// The Months view: one card per month in plan.json, then an "Add next month" card.
// The callbacks come from Tracker.
function MonthsView({ today, onPickDate, onOpenWeek, onAddMonth }) {
  const { plan } = usePlanActions()

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold text-slate-800 text-center mb-5">Months</h1>
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
