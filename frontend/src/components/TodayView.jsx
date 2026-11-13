import { usePlanActions } from '../PlanContext'
import { computeStreak, getTodayContext, todayString } from '../utils/planHelpers'
import { buildTimeline, routineTickIds } from '../utils/timeHelpers'
import ProgressBar from './ProgressBar'
import TaskRow from './TaskRow'
import Timeline from './Timeline'
import TodayHeader from './TodayHeader'

// The view the app opens on: clock and greeting, today's timeline (routine blocks
// with today's tasks inside), progress bars, streak, the next planned day if today
// has no tasks, and a "Catch up" list of unticked earlier tasks.
// "days" and "now" are props from Tracker; everything else comes from PlanContext.
function TodayView({ days, now }) {
  const { plan, isDone, openTaskForm } = usePlanActions()
  const today = todayString(now)
  const todayDay = days.find((d) => d.date === today)
  const { targetDay, catchUpTasks } = getTodayContext(days, today, isDone)
  const streak = computeStreak(days, today, isDone)

  const timeline = buildTimeline(plan.routine, today, todayDay?.tasks ?? [])
  const routineIds = routineTickIds(plan.routine, today)
  const routineDone = routineIds.filter(isDone).length

  const weekTasks = targetDay ? targetDay.week.days.flatMap((d) => d.tasks) : []
  const monthTasks = targetDay ? targetDay.month.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks)) : []

  return (
    <div className="animate-fade-up">
      <TodayHeader now={now} focus={todayDay?.focus} />

      {streak > 0 && (
        <p className="animate-pop text-center mb-4 text-amber-600 font-semibold">{streak} day streak</p>
      )}

      {targetDay && (
        <>
          <ProgressBar label="This week" done={weekTasks.filter((t) => isDone(t.id)).length} total={weekTasks.length} />
          <ProgressBar label="This month" done={monthTasks.filter((t) => isDone(t.id)).length} total={monthTasks.length} />
        </>
      )}

      <div className="flex items-center justify-between mt-6 mb-3">
        <h2 className="text-lg font-semibold text-slate-800">Today</h2>
        <div className="flex items-center gap-3">
          {routineIds.length > 0 && (
            <span className="text-sm text-slate-500">
              Routine today: <span className="font-semibold text-slate-700 tabular-nums">{routineDone}/{routineIds.length}</span>
            </span>
          )}
          <button
            onClick={() => openTaskForm({ mode: 'add', date: today })}
            className="text-sm font-medium text-white bg-teal-600 rounded-full px-3 py-1.5 active:scale-95 transition"
          >
            + Add task
          </button>
        </div>
      </div>
      <Timeline timeline={timeline} date={today} now={now} />

      {targetDay && targetDay.date !== today && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Next up — {targetDay.date}</h2>
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            {targetDay.tasks.map((task) => (
              <TaskRow key={task.id} task={task} date={targetDay.date} large />
            ))}
          </div>
        </>
      )}
      {!targetDay && (
        <p className="text-center text-slate-500 py-8">No more days planned. Add tasks or import the next month.</p>
      )}

      {catchUpTasks.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Catch up</h2>
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
