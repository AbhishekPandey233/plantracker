import TaskRow from './TaskRow'

// Turns "2026-11-18" into a weekday name like "Wednesday".
function dayName(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
}

// One card per day: date, day name, focus, and its task rows.
// "isDone" and "onToggle" come from the useProgress hook, passed down from App.
function DayCard({ day, isDone, onToggle }) {
  const allDone = day.tasks.every((task) => isDone(task.id))

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold text-slate-800">{dayName(day.date)}</span>
          <span className="text-slate-400 text-sm ml-2">{day.date}</span>
          <span className="text-slate-500 text-sm ml-2">{day.focus}</span>
        </div>
        {allDone && (
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
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
