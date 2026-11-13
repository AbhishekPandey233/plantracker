import { shortDate } from '../utils/planHelpers'

// One labelled number in the summary. Rendered as a button when it's clickable.
function Stat({ label, children, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`block w-full text-left rounded-lg px-2 py-1.5 ${onClick ? 'hover:bg-slate-200 transition active:scale-95' : ''}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{children}</p>
    </Tag>
  )
}

// The progress numbers in the side panel. "summary" comes from planSummary() in Tracker.
function ProgressSummary({ summary, onMissedClick }) {
  const s = summary
  const pct = s.plannedDays ? s.completedDays / s.plannedDays : 0
  const target = s.targetEnd && shortDate(s.targetEnd).split(' ').slice(1).join(' ') // "16 May"

  return (
    <div className="animate-fade-up space-y-1">
      <div className="px-2 pb-1">
        <p className="text-sm text-slate-700">
          <span className="font-semibold tabular-nums">{s.completedDays}</span> of {s.plannedDays} days done
        </p>
        {/* Same smooth scaleX trick as ProgressBar. */}
        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
          <div className="bg-teal-600 h-1.5 rounded-full origin-left transition-transform duration-700" style={{ transform: `scaleX(${pct})` }} />
        </div>
      </div>

      <Stat label="Remaining">
        <span className="tabular-nums">{s.plannedLeft}</span> planned days left
        {target && <span className="text-slate-500"> · {s.daysToTarget} days to {target}</span>}
      </Stat>

      <Stat label="Missed" onClick={s.missedDays ? onMissedClick : undefined}>
        <span className={`tabular-nums ${s.missedDays ? 'text-red-700 font-semibold' : ''}`}>{s.missedDays}</span>{' '}
        {s.missedDays === 1 ? 'day' : 'days'}
        {s.missedDays > 0 && <span className="text-slate-400"> · catch up →</span>}
      </Stat>

      <Stat label="Streak">
        <span className="tabular-nums font-semibold text-amber-600">{s.streak}</span> now
        <span className="text-slate-500"> · best {s.bestStreak}</span>
      </Stat>

      <Stat label="Months planned">
        {s.monthsPlanned}
        {s.targetMonths && ` of ${s.targetMonths}`} months
      </Stat>
    </div>
  )
}

export default ProgressSummary
