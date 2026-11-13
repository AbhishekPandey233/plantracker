import { usePlanActions } from '../PlanContext'
import { todayString } from '../utils/planHelpers'
import { routineTickIds } from '../utils/timeHelpers'
import TaskRow from './TaskRow'

const smallButton = 'text-xs font-medium text-slate-500 hover:text-teal-600 hover:bg-slate-50 rounded-full px-2 py-1 transition active:scale-95'

// Turns "2026-11-18" into a weekday name like "Wednesday".
function dayName(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
}

// One card per day: date, day name, focus, its task rows, and day-level buttons
// (Add task, Mark day done, Untick day). Tick state comes from PlanContext.
// "index" is the card's position, used to stagger the fade-in (each card 90ms later).
function DayCard({ day, index = 0 }) {
  const { plan, isDone, setMany, openTaskForm } = usePlanActions()
  // .every() on an empty list is true, so also require at least one task
  // before calling a day "done".
  const allDone = day.tasks.length > 0 && day.tasks.every((task) => isDone(task.id))
  const isToday = day.date === todayString()

  // Day-level buttons cover the day's tasks and its routine ticks.
  const dayIds = [...day.tasks.map((t) => t.id), ...routineTickIds(plan.routine, day.date)]
  const anyTicked = dayIds.some(isDone)
  const everyTicked = dayIds.length > 0 && dayIds.every(isDone)

  return (
    <div
      id={`day-${day.date}`} // so the calendar can scroll to this card
      style={{ animationDelay: `${index * 90}ms` }}
      className={`animate-fade-up bg-white rounded-xl shadow-sm p-4 mb-4 transition-shadow duration-200 hover:shadow-md ${
        isToday ? 'ring-2 ring-teal-500' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold text-slate-800">{dayName(day.date)}</span>
          <span className="text-slate-400 text-sm ml-2">{day.date}</span>
          <span className="text-slate-500 text-sm ml-2">{day.focus}</span>
        </div>
        {allDone && (
          // animate-pop: the badge only mounts when the last task is ticked, so it pops in right then.
          <span className="animate-pop bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">Done</span>
        )}
      </div>

      {day.tasks.length === 0 && <p className="text-sm text-slate-400 py-1">No tasks on this day.</p>}
      {day.tasks.map((task) => (
        <TaskRow key={task.id} task={task} date={day.date} />
      ))}

      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-200">
        <button className={smallButton} onClick={() => openTaskForm({ mode: 'add', date: day.date })}>+ Add task</button>
        {!everyTicked && dayIds.length > 0 && (
          <button className={smallButton} onClick={() => setMany(dayIds, true, `Marked ${dayName(day.date)} done`)}>Mark day done</button>
        )}
        {anyTicked && (
          <button className={smallButton} onClick={() => setMany(dayIds, false, `Unticked ${dayName(day.date)}`)}>Untick day</button>
        )}
      </div>
    </div>
  )
}

export default DayCard
