import { useState } from 'react'
import plan from './data/plan.json'
import { useProgress } from './hooks/useProgress'
import WeekSelector from './components/WeekSelector'
import DayCard from './components/DayCard'

// Flatten months -> weeks into one list, so Prev/Next can just move by index.
const weeks = plan.months.flatMap((month) => month.weeks)

// Picks the week that contains today's date, or the first week if none does.
function currentWeekIndex() {
  const today = new Date().toISOString().slice(0, 10)
  const index = weeks.findIndex((week) => today >= week.start && today <= week.end)
  return index === -1 ? 0 : index
}

// App is the root component: everything on the page is rendered from here.
function App() {
  // useState: weekIndex is state React remembers between renders. Passing a
  // function (not a value) means currentWeekIndex() only runs once, on mount.
  const [weekIndex, setWeekIndex] = useState(currentWeekIndex)
  const { isDone, toggle } = useProgress()
  const week = weeks[weekIndex]

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-indigo-600 text-center mb-6">Plan Tracker</h1>
        <WeekSelector
          week={week}
          onPrev={() => setWeekIndex((i) => i - 1)}
          onNext={() => setWeekIndex((i) => i + 1)}
          hasPrev={weekIndex > 0}
          hasNext={weekIndex < weeks.length - 1}
        />
        {week.days.map((day) => (
          <DayCard key={day.date} day={day} isDone={isDone} onToggle={toggle} />
        ))}
      </div>
    </main>
  )
}

export default App
