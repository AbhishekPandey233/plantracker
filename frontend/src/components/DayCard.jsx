import { todayString } from '../utils/planHelpers'
import TaskRow from './TaskRow'

// Turns "2026-11-18" into a weekday name like "Wednesday".
function dayName(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
}

// One card per day: date, day name, focus, and its task rows.
// "isDone" and "onToggle" come from the useProgress hook, passed down from App.
// "index" is the card's position, used to stagger the fade-in (each card 60ms later).
function DayCard({ day, isDone, onToggle, index = 0 }) {
  // .every() on an empty list is true, so also require at least one task
  // before calling a day "done".
  const allDone = day.tasks.length > 0 && day.tasks.every((task) => isDone(task.id))
  const isToday = day.date === todayString()

  return (
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className={`animate-fade-up bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 mb-4 transition-shadow duration-200 hover:shadow-md ${
        isToday ? 'ring-2 ring-teal-500 dark:ring-teal-400' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{dayName(day.date)}</span>
          <span className="text-slate-400 dark:text-slate-500 text-sm ml-2">{day.date}</span>
          <span className="text-slate-500 dark:text-slate-400 text-sm ml-2">{day.focus}</span>
        </div>
        {allDone && (
          // animate-pop: the badge only mounts when the last task is ticked, so it pops in right then.
          <span className="animate-pop bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-semibold px-2 py-1 rounded-full">
            Done
          </span>
        )}
      </div>
      {day.tasks.map((task) => (
        <TaskRow key={task.id} task={task} done={isDone(task.id)} onToggle={onToggle} />
      ))}
    </div>
  )
}

export default DayCard
