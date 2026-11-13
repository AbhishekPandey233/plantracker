import { formatClock, greeting, kathmanduParts } from '../utils/timeHelpers'

// Live clock and greeting at the top of the Today tab. "now" comes from the
// useNow hook in Tracker, so this re-renders every 30 seconds.
function TodayHeader({ now, focus }) {
  const { minutes } = kathmanduParts(now)
  return (
    <div className="text-center mb-5 animate-fade-up">
      <p className="text-sm font-medium text-slate-500 tabular-nums">{formatClock(now)}</p>
      <p className="text-2xl font-semibold text-slate-800 mt-1">{greeting(minutes)}, Abhishek</p>
      {focus && <p className="text-slate-500 mt-1">Today: {focus}</p>}
    </div>
  )
}

export default TodayHeader
