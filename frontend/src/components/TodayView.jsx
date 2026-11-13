import { usePlanActions } from '../PlanContext'
import { computeStreak, getTodayContext, shortDate, todayString } from '../utils/planHelpers'
import { buildTimeline, kathmanduParts, routineTickIds } from '../utils/timeHelpers'
import JournalCard from './JournalCard'
import ProgressBar from './ProgressBar'
import TaskRow from './TaskRow'
import Timeline from './Timeline'
import TodayHeader from './TodayHeader'

const JOURNAL_FROM = 21 * 60 + 30 // the end-of-day card appears at 21:30 Kathmandu time

// The view the app opens on: clock and greeting, the day's timeline (routine blocks
// with the day's tasks inside), progress bars, streak, the next planned day if today
// has no tasks, and a "Catch up" list of unticked earlier tasks.
// "date" is the day shown: today, or another day (then it's the day detail: its
// timeline, all tickable, plus its journal). "days", "now" and "onBackToToday" come from Tracker.
function TodayView({ days, now, date, onBackToToday, onPickDate }) {
  const { plan, isDone, openTaskForm } = usePlanActions()
  const today = todayString(now)
  const isToday = date === today
  const day = days.find((d) => d.date === date)
  const { targetDay, catchUpTasks } = getTodayContext(days, today, isDone)
  const streak = computeStreak(days, today, isDone)

  const timeline = buildTimeline(plan.routine, date, day?.tasks ?? [])
  const routineIds = routineTickIds(plan.routine, date)
  const routineDone = routineIds.filter(isDone).length
  const tasksDone = (day?.tasks ?? []).filter((t) => isDone(t.id)).length

  const weekTasks = targetDay ? targetDay.week.days.flatMap((d) => d.tasks) : []
  const monthTasks = targetDay ? targetDay.month.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks)) : []

  return (
    <div className="animate-fade-up">
      {/* View any day: picking a date shows that day here, all tickable, like today. */}
      <div className="flex justify-end -mt-2 mb-1">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          View day
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && onPickDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>
      </div>
      {isToday ? (
        <TodayHeader now={now} focus={day?.focus} />
      ) : (
        <div className="text-center mb-5 animate-fade-up">
          <p className="text-2xl font-semibold text-slate-800">Viewing: {shortDate(date)}</p>
          {day?.focus && <p className="text-slate-500 mt-1">{day.focus}</p>}
          <button
            onClick={onBackToToday}
            className="animate-pop mt-3 text-sm font-medium text-teal-600 bg-white rounded-full px-4 py-1.5 shadow-sm hover:shadow active:scale-95 transition"
          >
            ↩ Back to today
          </button>
        </div>
      )}

      {isToday && streak > 0 && (
        <p className="animate-pop text-center mb-4 text-amber-600 font-semibold">{streak} day streak</p>
      )}

      {isToday && targetDay && (
        <>
          <ProgressBar label="This week" done={weekTasks.filter((t) => isDone(t.id)).length} total={weekTasks.length} />
          <ProgressBar label="This month" done={monthTasks.filter((t) => isDone(t.id)).length} total={monthTasks.length} />
        </>
      )}

      <div className="flex items-center justify-between mt-6 mb-3">
        <h2 className="text-lg font-semibold text-slate-800">
          {isToday ? 'Today' : 'That day'}
          {!isToday && day?.tasks.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500 tabular-nums">{tasksDone}/{day.tasks.length} tasks done</span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {routineIds.length > 0 && (
            <span className="text-sm text-slate-500">
              Routine: <span className="font-semibold text-slate-700 tabular-nums">{routineDone}/{routineIds.length}</span>
            </span>
          )}
          <button
            onClick={() => openTaskForm({ mode: 'add', date })}
            className="text-sm font-medium text-white bg-teal-600 rounded-full px-3 py-1.5 active:scale-95 transition"
          >
            + Add task
          </button>
        </div>
      </div>
      {/* The "Now" highlight only makes sense on today's timeline. */}
      <Timeline timeline={timeline} date={date} now={now} showNow={isToday} />

      {/* key={date}: another date gets a fresh card that loads its own entry. */}
      {date < today && <JournalCard key={date} date={date} title="Journal" />}
      {isToday && kathmanduParts(now).minutes >= JOURNAL_FROM && (
        <JournalCard key={date} date={date} title="What did you learn today?" />
      )}

      {isToday && targetDay && targetDay.date !== today && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Next up — {targetDay.date}</h2>
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            {targetDay.tasks.map((task) => (
              <TaskRow key={task.id} task={task} date={targetDay.date} large />
            ))}
          </div>
        </>
      )}
      {isToday && !targetDay && (
        <p className="text-center text-slate-500 py-8">No more days planned. Add tasks or import the next month.</p>
      )}

      {isToday && catchUpTasks.length > 0 && (
        <>
          <h2 id="catch-up" className="text-lg font-semibold text-slate-800 mt-6 mb-2 rounded-lg">Catch up</h2>
          <div className="bg-white rounded-xl shadow-sm p-4">
            {catchUpTasks.map((task) => (
              <TaskRow key={task.id} task={task} date={task.date} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default TodayView
