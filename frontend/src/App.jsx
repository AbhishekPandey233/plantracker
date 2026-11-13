import { useState } from 'react'
import { flushSync } from 'react-dom'
import plan from './data/plan.json'
import { useProgress } from './hooks/useProgress'
import { flattenDays, todayString } from './utils/planHelpers'
import WeekSelector from './components/WeekSelector'
import DayCard from './components/DayCard'
import TodayView from './components/TodayView'

// Flatten months -> weeks into one list, so Prev/Next can just move by index.
const weeks = plan.months.flatMap((month) => month.weeks)
// Flatten months -> weeks -> days into one list, used by the Today view.
const days = flattenDays(plan)

// Picks the week that contains today's date, or the first week if none does.
function currentWeekIndex() {
  const today = todayString()
  const index = weeks.findIndex((week) => today >= week.start && today <= week.end)
  return index === -1 ? 0 : index
}

// Runs a state change as an animated page transition.
// dir: 1 = forward (new page slides in from the right), -1 = back (from the left).
function withTransition(update, dir) {
  // Older browsers without View Transitions just switch instantly.
  if (!document.startViewTransition) return update()
  document.documentElement.style.setProperty('--dir', dir)
  // flushSync makes React update the page right now (normally it waits a little),
  // so the browser can take its "after" picture straight away.
  document.startViewTransition(() => flushSync(update))
}

// One small button for a tab. "active" controls which tab looks selected.
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full font-medium transition-[background-color,color,transform] duration-200 active:scale-95 ${
        active
          ? 'bg-teal-600 dark:bg-teal-500 text-white'
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

// App is the root component: everything on the page is rendered from here.
function App() {
  // useState: tab/weekIndex are state React remembers between renders.
  // Passing a function (not a value) to useState means it only runs once, on mount.
  const [tab, setTab] = useState('today') // 'today' or 'weeks'
  const [weekIndex, setWeekIndex] = useState(currentWeekIndex)
  const { isDone, toggle } = useProgress()
  const week = weeks[weekIndex]

  // Today is "left" of Weeks, so going to Weeks slides forward and back to Today slides back.
  function changeTab(next) {
    if (next === tab) return // clicking the open tab shouldn't animate
    withTransition(() => setTab(next), next === 'weeks' ? 1 : -1)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-teal-600 dark:text-teal-400 text-center mb-6">Plan Tracker</h1>

        <div className="flex justify-center gap-2 mb-6">
          <TabButton active={tab === 'today'} onClick={() => changeTab('today')}>
            Today
          </TabButton>
          <TabButton active={tab === 'weeks'} onClick={() => changeTab('weeks')}>
            Weeks
          </TabButton>
        </div>

        {/* viewTransitionName tells the browser this box is the "page" that slides.
            The title and tabs stay outside it, so they don't move. */}
        <div style={{ viewTransitionName: 'page' }}>
        {/* key: when the key changes, React throws the old element away and mounts
            a new one, so the fade-in animations replay on every tab/week switch. */}
        {tab === 'today' ? (
          <TodayView key="today" days={days} isDone={isDone} onToggle={toggle} />
        ) : (
          <div key={week.id}>
            <WeekSelector
              week={week}
              onPrev={() => withTransition(() => setWeekIndex((i) => i - 1), -1)}
              onNext={() => withTransition(() => setWeekIndex((i) => i + 1), 1)}
              hasPrev={weekIndex > 0}
              hasNext={weekIndex < weeks.length - 1}
            />
            {week.days.length === 0 ? (
              <p className="text-center text-slate-500 dark:text-slate-400 py-12">
                No days in this week yet — add some to plan.json.
              </p>
            ) : (
              week.days.map((day, i) => (
                <DayCard key={day.date} day={day} isDone={isDone} onToggle={toggle} index={i} />
              ))
            )}
          </div>
        )}
        </div>
      </div>
    </main>
  )
}

export default App
