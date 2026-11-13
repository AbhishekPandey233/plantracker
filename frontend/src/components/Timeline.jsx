import { kathmanduParts, nowAndNext } from '../utils/timeHelpers'
import TaskRow from './TaskRow'
import TimelineItem from './TimelineItem'

// Today's routine blocks and timed tasks in time order, plus an "Anytime today" group.
// "timeline" comes from buildTimeline() in timeHelpers.js.
// "showNow" is false when the timeline isn't for today (no "Now" highlight then).
function Timeline({ timeline, date, now, showNow = true }) {
  const { minutes } = kathmanduParts(now)
  const { nowKeys = [], nextKey, minutesUntilNext } = showNow ? nowAndNext(timeline.items, minutes) : {}

  // Works out how each item should look: now / next / past / later.
  function stateOf(item) {
    if (!showNow) return 'later'
    if (nowKeys.includes(item.key)) return 'now'
    if (item.key === nextKey) return 'next'
    return (item.end ?? item.start) <= minutes ? 'past' : 'later'
  }

  return (
    <div>
      <ol>
        {timeline.items.map((item) => (
          <TimelineItem key={item.key} item={item} date={date} state={stateOf(item)} minutesUntil={minutesUntilNext} />
        ))}
      </ol>

      {timeline.anytime.length > 0 && (
        <div className="ml-17 mt-2 bg-white rounded-xl shadow-sm px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-600 mb-1">{showNow ? 'Anytime today' : 'Anytime'}</h3>
          {timeline.anytime.map((task) => (
            <TaskRow key={task.id} task={task} date={date} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Timeline
