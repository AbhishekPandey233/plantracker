import { shortDate } from '../utils/planHelpers'
import { TASK_TYPES } from '../utils/validatePlan'

const input = 'rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-0'
const small = 'text-xs font-medium text-slate-500 hover:text-teal-600 rounded-full px-2 py-1 transition active:scale-95'

// Step 3 of the New month wizard: one section per week, one row per day with its
// focus and task rows. "edit(fn)" comes from MonthWizard: fn changes a copy of the draft.
function WizardDays({ draft, edit }) {
  return draft.weeks.map((week, wi) => (
    <section key={week.start} className="mb-5">
      <h3 className="font-semibold text-slate-800 text-sm mb-2">{week.title.trim() || `Week ${wi + 1}`}</h3>
      {week.days.map((day, di) => (
        <div key={day.date} className="rounded-lg bg-slate-50 p-2 mb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-20 shrink-0 text-xs font-semibold text-slate-600">{shortDate(day.date)}</span>
            <input
              className={`${input} flex-1`}
              placeholder="Focus (optional)"
              value={day.focus}
              onChange={(e) => edit((d) => (d.weeks[wi].days[di].focus = e.target.value))}
            />
          </div>
          {day.tasks.map((task, ti) => {
            // Changes one field of this task in the draft.
            const set = (field) => (e) => edit((d) => (d.weeks[wi].days[di].tasks[ti][field] = e.target.value))
            return (
              <div key={ti} className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:pl-[5.5rem] mb-1">
                <select className={`${input} w-24`} value={task.type} onChange={set('type')} aria-label="Type">
                  {TASK_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input className={`${input} w-28`} placeholder="Time" value={task.time} onChange={set('time')} aria-label="Time" />
                <input className={`${input} flex-1`} placeholder="Task text" value={task.text} onChange={set('text')} aria-label="Task text" />
                <input className={`${input} sm:w-32`} placeholder="Resources" value={task.resources} onChange={set('resources')} aria-label="Resources" />
                <button
                  className="h-7 w-7 shrink-0 rounded-full text-slate-400 hover:text-red-600 hover:bg-white transition"
                  aria-label="Remove task"
                  onClick={() => edit((d) => d.weeks[wi].days[di].tasks.splice(ti, 1))}
                >
                  ×
                </button>
              </div>
            )
          })}
          <div className="sm:pl-[5.5rem]">
            <button
              className={small}
              onClick={() => edit((d) => d.weeks[wi].days[di].tasks.push({ type: 'learn', time: '', text: '', resources: '' }))}
            >
              + task
            </button>
          </div>
        </div>
      ))}
    </section>
  ))
}

export default WizardDays
