import { usePlanActions } from '../PlanContext'
import { calendarRows, dayStatus, flattenDays, shortDate } from '../utils/planHelpers'

// The look of each day status. "complete" uses the same green as the day cards' Done badge.
const DOT = {
  complete: 'bg-green-600',
  partial: 'border-2 border-amber-500 bg-[linear-gradient(90deg,var(--color-amber-500)_50%,transparent_50%)]',
  missed: 'bg-red-800 scale-75',
  today: 'border-2 border-teal-500',
  upcoming: 'border-2 border-slate-300',
}

// A small coloured dot for one day status ("empty" draws nothing).
export function StatusDot({ status, large }) {
  if (!DOT[status]) return <span className={large ? 'h-2.5 w-2.5' : 'h-2 w-2'} />
  return <span className={`block rounded-full ${large ? 'h-2.5 w-2.5' : 'h-2 w-2'} ${DOT[status]}`} />
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

// A Monday-to-Sunday grid of the dates start..end with a status dot under each.
// Dates outside start..end are left blank. Clicking a planned date calls onPick(date).
// Used by the side panel's mini calendar and (large) by each Months view card.
function CalendarGrid({ start, end, today, onPick, large = false }) {
  const { plan, isDone } = usePlanActions()
  const byDate = new Map(flattenDays(plan).map((d) => [d.date, d]))

  return (
    <div className={`grid grid-cols-7 text-center ${large ? 'gap-1' : 'gap-0.5'}`}>
      {WEEKDAYS.map((w) => (
        <span key={w} className="text-[10px] font-medium text-slate-400 pb-1">{w}</span>
      ))}
      {calendarRows(start, end).flat().map((date) => {
        if (date < start || date > end) return <span key={date} />
        const day = byDate.get(date)
        const status = dayStatus(day, date, today, isDone)
        const done = day ? day.tasks.filter((t) => isDone(t.id)).length : 0
        const dayNumber = Number(date.slice(8))
        const tooltip = day?.tasks.length
          ? [shortDate(date), day.focus, `${done}/${day.tasks.length} done`].filter(Boolean).join(' · ')
          : shortDate(date)
        return (
          <button
            key={date}
            title={tooltip}
            disabled={!day?.tasks.length}
            onClick={() => onPick(date)}
            className={`flex flex-col items-center gap-0.5 rounded-lg transition active:scale-90 enabled:hover:bg-slate-200 disabled:cursor-default ${
              large ? 'py-1.5' : 'py-1'
            }`}
          >
            <span
              className={`tabular-nums leading-none ${large ? 'text-sm' : 'text-xs'} ${
                date === today ? 'font-bold text-teal-600' : day?.tasks.length ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              {/* The 1st of a month shows its short name, handy when a grid spans two months. */}
              {dayNumber === 1 && large ? shortDate(date).split(' ').slice(1).join(' ') : dayNumber}
            </span>
            <StatusDot status={status} large={large} />
          </button>
        )
      })}
    </div>
  )
}

export default CalendarGrid
