import { useState } from 'react'
import { monthBounds } from '../utils/planHelpers'
import CalendarGrid, { StatusDot } from './CalendarGrid'

const STATUS_LABELS = { complete: 'Done', partial: 'Partly done', missed: 'Missed', today: 'Today', upcoming: 'Upcoming' }

const navButton = 'h-7 w-7 rounded-full text-slate-500 hover:bg-slate-200 transition active:scale-90'

// The small month calendar in the side panel, opening on the current month.
// "today" and "onPick" (open that day in the Weeks view) come from Tracker.
function MiniCalendar({ today, onPick }) {
  // useState: how many months away from the current one we're looking at.
  const [offset, setOffset] = useState(0)
  const { start, end } = monthBounds(today.slice(0, 7), offset)
  const title = new Date(start + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

  return (
    <div className="mt-4 pt-3 border-t border-slate-200 animate-fade-up">
      <div className="flex items-center justify-between mb-1">
        <button className={navButton} onClick={() => setOffset(offset - 1)} aria-label="Previous month">‹</button>
        <button
          className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition"
          onClick={() => setOffset(0)}
          title="Back to this month"
        >
          {title}
        </button>
        <button className={navButton} onClick={() => setOffset(offset + 1)} aria-label="Next month">›</button>
      </div>

      {/* key: a new key per month replays the fade-in when switching months. */}
      <div key={start} className="animate-fade-up">
        <CalendarGrid start={start} end={end} today={today} onPick={onPick} />
      </div>

      <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-2 px-1">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status} className="flex items-center gap-1 text-[10px] text-slate-500">
            <StatusDot status={status} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default MiniCalendar
