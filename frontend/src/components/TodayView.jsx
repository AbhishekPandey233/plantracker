import { computeStreak, getTodayContext, todayString } from '../utils/planHelpers'
import ProgressBar from './ProgressBar'
import TaskRow from './TaskRow'

// The view the app opens on: today's tasks (or the next day that has any),
// a "Catch up" list of unticked earlier tasks, week/month progress, and
// a streak counter. "days", "isDone" and "onToggle" are passed down from App.
function TodayView({ days, isDone, onToggle }) {
  const today = todayString()
  const { targetDay, catchUpTasks } = getTodayContext(days, today, isDone)
  const streak = computeStreak(days, today, isDone)

  if (!targetDay) {
    return (
      <p className="text-center text-slate-500 dark:text-slate-400 py-12">
        No more days planned — add another month to plan.json.
      </p>
    )
  }

  const weekTasks = targetDay.week.days.flatMap((d) => d.tasks)
  const monthTasks = targetDay.month.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks))

  return (
    <div>
      {streak > 0 && (
        <p className="text-center mb-4 text-amber-600 dark:text-amber-400 font-semibold">
          {streak} day streak
        </p>
      )}

      <ProgressBar
        label="This week"
        done={weekTasks.filter((t) => isDone(t.id)).length}
        total={weekTasks.length}
      />
      <ProgressBar
        label="This month"
        done={monthTasks.filter((t) => isDone(t.id)).length}
        total={monthTasks.length}
      />

      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-6 mb-2">
        {targetDay.date === today ? 'Today' : `Next up — ${targetDay.date}`}
      </h2>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 mb-4">
        {targetDay.tasks.map((task) => (
          <TaskRow key={task.id} task={task} done={isDone(task.id)} onToggle={onToggle} large />
        ))}
      </div>

      {catchUpTasks.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-6 mb-2">Catch up</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
            {catchUpTasks.map((task) => (
              <TaskRow key={task.id} task={task} done={isDone(task.id)} onToggle={onToggle} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default TodayView
