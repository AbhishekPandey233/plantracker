import { useEffect, useState } from 'react'
import { PlanContext } from '../PlanContext'
import { useNow } from '../hooks/useNow'
import { useProgress } from '../hooks/useProgress'
import { addDays, flattenDays, todayString } from '../utils/planHelpers'
import { routineTickIds } from '../utils/timeHelpers'
import { withTransition } from '../utils/transition'
import DayCard from './DayCard'
import ImportPanel from './ImportPanel'
import Menu from './Menu'
import TabButton from './TabButton'
import TaskForm from './TaskForm'
import Toast from './Toast'
import TodayView from './TodayView'
import WeekSelector from './WeekSelector'

// Index of the week that contains a date, or the first week if none does.
function weekIndexFor(weeks, date) {
  const index = weeks.findIndex((week) => date >= week.start && date <= week.end)
  return index === -1 ? 0 : index
}

// True while the user is typing in a text field, so shortcuts don't fire.
function isTyping(target) {
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true
  return tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(target.type)
}

// The main screen, shown once plan.json has loaded. "plan" and "savePlan" come from App.
function Tracker({ plan, savePlan }) {
  const now = useNow()
  const { isDone, toggle, setMany, resetAll, undo, toast, closeToast, saveError } = useProgress()
  // useState: values React remembers between renders.
  const [tab, setTab] = useState('today') // 'today' or 'weeks'
  const [weekIndex, setWeekIndex] = useState(null) // null = "the week that contains today"
  const [form, setForm] = useState(null) // the Add/Edit task form: null = closed
  const [importing, setImporting] = useState(false)

  const today = todayString(now)
  // Flatten months -> weeks into one list, so Prev/Next can just move by index.
  const weeks = plan.months.flatMap((month) => month.weeks)
  // Flatten months -> weeks -> days into one list, used by the Today view.
  const days = flattenDays(plan)
  const currentIndex = weekIndexFor(weeks, today)
  const index = Math.min(weekIndex ?? currentIndex, weeks.length - 1)
  const week = weeks[index]

  // Today's plan tasks, for the browser tab title.
  const todayTasks = days.find((d) => d.date === today)?.tasks ?? []
  const todayDone = todayTasks.filter((t) => isDone(t.id)).length

  // Today is "left" of Weeks, so going to Weeks slides forward and back to Today slides back.
  function changeTab(next) {
    if (next === tab) return // clicking the open tab shouldn't animate
    withTransition(() => setTab(next), next === 'weeks' ? 1 : -1)
  }

  // Moves by `delta` weeks (-1 = previous, 1 = next).
  // setWeekIndex(prev => ...) works from the latest value, so fast clicks during the
  // slide animation each count, instead of all using the same not-yet-updated index.
  function stepWeek(delta) {
    if ((delta < 0 && index <= 0) || (delta > 0 && index >= weeks.length - 1)) return
    withTransition(
      () => setWeekIndex((prev) => Math.max(0, Math.min(weeks.length - 1, (prev ?? currentIndex) + delta))),
      delta,
    )
  }

  function jumpToThisWeek() {
    withTransition(() => setWeekIndex(null), currentIndex > index ? 1 : -1)
  }

  // Every tick in the shown week: its tasks plus the routine blocks of each date.
  function weekTickIds() {
    const ids = week.days.flatMap((d) => d.tasks.map((t) => t.id))
    for (let date = week.start; date <= week.end; date = addDays(date, 1)) ids.push(...routineTickIds(plan.routine, date))
    return ids
  }

  // Browser tab title shows today's progress, e.g. "Plan Tracker (2/3 today)".
  // useEffect runs after rendering, whenever the numbers in [ ] change.
  useEffect(() => {
    document.title = todayTasks.length ? `Plan Tracker (${todayDone}/${todayTasks.length} today)` : 'Plan Tracker'
  }, [todayDone, todayTasks.length])

  // Keyboard shortcuts: ← / → week, T Today, W Weeks, N add task.
  // No dependency list: it re-subscribes after every render, so it always sees the latest state.
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || form || importing) return
      const key = e.key.toLowerCase()
      if (key === 't') changeTab('today')
      else if (key === 'w') changeTab('weeks')
      else if (key === 'n') {
        e.preventDefault() // don't type the "n" into the form that opens
        setForm({ mode: 'add', date: tab === 'weeks' && week && !(today >= week.start && today <= week.end) ? week.start : today })
      } else if (tab === 'weeks' && key === 'arrowleft') stepWeek(-1)
      else if (tab === 'weeks' && key === 'arrowright') stepWeek(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Shared with every component below through PlanContext (see PlanContext.js).
  const actions = { plan, savePlan, isDone, toggle, setMany, openTaskForm: setForm }

  return (
    <PlanContext.Provider value={actions}>
      <main className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="relative mb-6">
            <h1 className="text-3xl font-bold text-teal-600 text-center">Plan Tracker</h1>
            <div className="absolute right-0 top-0">
              <Menu onImport={() => setImporting(true)} onResetAll={resetAll} />
            </div>
          </div>

          {saveError && (
            <p className="mb-4 rounded-xl bg-amber-100 text-amber-800 text-sm px-4 py-3 whitespace-pre-line">{saveError}</p>
          )}

          <div className="flex justify-center gap-2 mb-6">
            <TabButton active={tab === 'today'} onClick={() => changeTab('today')}>Today</TabButton>
            <TabButton active={tab === 'weeks'} onClick={() => changeTab('weeks')}>Weeks</TabButton>
          </div>

          {/* viewTransitionName tells the browser this box is the "page" that slides.
              The title and tabs stay outside it, so they don't move. */}
          <div style={{ viewTransitionName: 'page' }}>
            {/* key: when the key changes, React throws the old element away and mounts
                a new one, so the fade-in animations replay on every tab/week switch. */}
            {tab === 'today' ? (
              <TodayView key="today" days={days} now={now} />
            ) : !week ? (
              <p className="text-center text-slate-500 py-12">No weeks in plan.json yet.</p>
            ) : (
              <div key={week.id}>
                {index !== currentIndex && (
                  <div className="text-center -mt-2 mb-3">
                    <button
                      onClick={jumpToThisWeek}
                      className="animate-pop text-sm font-medium text-teal-600 bg-white rounded-full px-4 py-1.5 shadow-sm hover:shadow active:scale-95 transition"
                    >
                      ↩ Jump to this week
                    </button>
                  </div>
                )}
                <WeekSelector
                  week={week}
                  onPrev={() => stepWeek(-1)}
                  onNext={() => stepWeek(1)}
                  hasPrev={index > 0}
                  hasNext={index < weeks.length - 1}
                  canUntick={weekTickIds().some(isDone)}
                  onUntickWeek={() => setMany(weekTickIds(), false, `Unticked ${week.title.split(':')[0]}`)}
                />
                {week.days.length === 0 ? (
                  <p className="text-center text-slate-500 py-12">No days in this week yet. Press N to add a task.</p>
                ) : (
                  week.days.map((day, i) => <DayCard key={day.date} day={day} index={i} />)
                )}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-10">
            Shortcuts: <kbd>T</kbd> Today · <kbd>W</kbd> Weeks · <kbd>←</kbd> <kbd>→</kbd> week · <kbd>N</kbd> add task
          </p>
        </div>
      </main>

      {form && <TaskForm key={JSON.stringify(form)} form={form} onClose={() => setForm(null)} />}
      {importing && <ImportPanel onClose={() => setImporting(false)} />}
      <Toast toast={toast} onUndo={undo} onClose={closeToast} />
    </PlanContext.Provider>
  )
}

export default Tracker
