import { greeting, kathmanduParts } from '../utils/timeHelpers'

// Greeting at the top of the Today view (the clock lives in the side panel). "now" comes from the
// useNow hook in Tracker, so this re-renders every 30 seconds.
function TodayHeader({ now, focus }) {
  const { minutes } = kathmanduParts(now)
  return (
    <div className="text-center mb-5 animate-fade-up">
      <p className="text-2xl font-semibold text-slate-800">{greeting(minutes)}, Abhishek</p>
      {focus && <p className="text-slate-500 mt-1">Today: {focus}</p>}
    </div>
  )
}

export default TodayHeader
