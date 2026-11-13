import { usePlanActions } from '../PlanContext'
import { planSummary, shortDate } from '../utils/planHelpers'
import CalendarGrid from './CalendarGrid'
import ProgressBar from './ProgressBar'

// One month in the Months view: dates, progress, a calendar and its weeks.
// "children" is extra content from the parent (the Edit/Add week buttons, Phase 6).
function MonthCard({ month, today, index, onPickDate, onOpenWeek, children }) {
  const { isDone } = usePlanActions()
  const tasks = month.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks))
  // planSummary works on any plan, so give it a plan with just this month.
  const s = planSummary({ months: [month] }, today, isDone)
  const isCurrent = month.start <= today && today <= month.end

  return (
    <section
      style={{ animationDelay: `${index * 90}ms` }}
      className={`animate-fade-up bg-white rounded-xl shadow-sm p-5 mb-5 ${isCurrent ? 'ring-2 ring-teal-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-lg">{month.title}</h2>
          <p className="text-sm text-slate-400">
            {shortDate(month.start)} to {shortDate(month.end)}
            {isCurrent && <span className="ml-2 text-xs font-semibold text-teal-600">This month</span>}
          </p>
        </div>
        {children}
      </div>

      <ProgressBar label="Tasks" done={tasks.filter((t) => isDone(t.id)).length} total={tasks.length} />
      <p className="text-sm text-slate-600 mb-4">
        <span className="font-semibold tabular-nums">{s.completedDays}</span>/{s.plannedDays} days complete
        {s.missedDays > 0 && <span className="text-red-700"> · {s.missedDays} missed</span>}
      </p>

      <div className="grid sm:grid-cols-2 gap-5">
        <CalendarGrid start={month.start} end={month.end} today={today} onPick={onPickDate} large />
        <ul className="space-y-1">
          {month.weeks.map((week) => (
            <li key={week.id}>
              <button
                onClick={() => onOpenWeek(week)}
                className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-50 transition active:scale-[0.98]"
              >
                <p className={`text-sm font-medium ${week.start <= today && today <= week.end ? 'text-teal-600' : 'text-slate-700'}`}>
                  {week.title}
                </p>
                {week.goal && <p className="text-xs text-slate-500">{week.goal}</p>}
              </button>
            </li>
          ))}
          {month.weeks.length === 0 && <li className="text-sm text-slate-400 px-2">No weeks yet.</li>}
        </ul>
      </div>
    </section>
  )
}

export default MonthCard
