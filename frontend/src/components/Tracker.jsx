import { useEffect, useRef, useState } from 'react'
import { PlanContext } from '../PlanContext'
import { useNow } from '../hooks/useNow'
import { useProgress } from '../hooks/useProgress'
import { addDays, flattenDays, newlyCompleted, planSummary, todayString } from '../utils/planHelpers'
import { routineTickIds } from '../utils/timeHelpers'
import { withTransition } from '../utils/transition'
import Confetti from './Confetti'
import DayCard from './DayCard'
import ImportPanel from './ImportPanel'
import Menu from './Menu'
import MiniCalendar from './MiniCalendar'
import MonthWizard from './MonthWizard'
import MonthsView from './MonthsView'
import Sidebar from './Sidebar'
import TaskForm from './TaskForm'
import Toast from './Toast'
import TodayView from './TodayView'
import WeekSelector from './WeekSelector'

// Index of the week that contains a date, or the first week if none does.
function weekIndexFor(weeks, date) {
  const index = weeks.findIndex((week) => date >= week.start && date <= week.end)
  return index === -1 ? 0 : index
}

const VIEWS = ['today', 'weeks', 'months'] // left to right, for the slide direction
const COLLAPSED_KEY = 'planTracker:sidebarCollapsed'

// The saved panel choice wins; with nothing saved, narrow windows start collapsed.
function loadCollapsed() {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    if (saved !== null) return saved === 'true'
  } catch {
    // storage blocked: fall back to the window width
  }
  return window.innerWidth < 900
}

// Scrolls an element into view and flashes an orange ring around it.
function flash(id) {
  const el = id && document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // Web Animations API: a one-off animation straight on the element, no CSS class needed.
  // Three orange pulses, so it's clear which card was picked.
  const on = { boxShadow: '0 0 0 4px #f97316' }
  const off = { boxShadow: '0 0 0 0 rgb(249 115 22 / 0)' }
  el.animate([off, on, off, on, off, on, off], { duration: 2100, easing: 'ease-in-out' })
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
  const [tab, setTab] = useState('today') // 'today', 'weeks' or 'months'
  const [collapsed, setCollapsed] = useState(loadCollapsed) // passing the function: it only runs on the first render
  const [weekIndex, setWeekIndex] = useState(null) // null = "the week that contains today"
  const [form, setForm] = useState(null) // the Add/Edit task form: null = closed
  const [importing, setImporting] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false) // the New month wizard
  const [confetti, setConfetti] = useState(null) // { id, big } while a burst is showing
  // useRef: remembers a value without re-rendering. Here: the id of an element to
  // scroll to once the next view has rendered.
  const pendingScroll = useRef(null)

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

  // Views sit left to right (Today, Weeks, Months): moving right slides forward, left slides back.
  function changeTab(next) {
    if (next === tab) return // clicking the open view shouldn't animate
    withTransition(() => setTab(next), VIEWS.indexOf(next) > VIEWS.indexOf(tab) ? 1 : -1)
  }

  // Opens a view (and optionally a week), then scrolls to and flashes the element
  // with id "anchor" (e.g. "day-2026-12-03" or "catch-up").
  function goTo(view, { week: nextWeek = weekIndex, anchor = null } = {}) {
    if (view === tab && nextWeek === weekIndex) return flash(anchor) // same page: just scroll
    pendingScroll.current = anchor
    const from = view === tab ? index : VIEWS.indexOf(tab)
    const to = view === tab ? (nextWeek ?? currentIndex) : VIEWS.indexOf(view)
    withTransition(() => {
      setTab(view)
      setWeekIndex(nextWeek)
    }, to >= from ? 1 : -1)
  }

  // Opens the Weeks view on the week containing `date` and scrolls to that day's card.
  function goToDate(date) {
    const i = weeks.findIndex((w) => w.start <= date && date <= w.end)
    if (i !== -1) goTo('weeks', { week: i, anchor: `day-${date}` })
  }

  // No dependency list: runs after every render, and scrolls if goTo left a target.
  useEffect(() => {
    if (!pendingScroll.current) return
    flash(pendingScroll.current)
    pendingScroll.current = null
  })

  function toggleSidebar() {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!prev))
      } catch {
        // storage blocked: the choice just won't survive a refresh
      }
      return !prev
    })
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

  // Keyboard shortcuts: ← / → week, T Today, W Weeks, M Months, [ panel, N add task.
  // No dependency list: it re-subscribes after every render, so it always sees the latest state.
  useEffect(() => {
    function onKey(e) {
      // Any open dialog (task form, import, wizard, edit/delete) pauses the shortcuts.
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector('[aria-modal]')) return
      const key = e.key.toLowerCase()
      if (key === 't') changeTab('today')
      else if (key === 'w') changeTab('weeks')
      else if (key === 'm') changeTab('months')
      else if (key === '[') toggleSidebar()
      else if (key === 'n') {
        e.preventDefault() // don't type the "n" into the form that opens
        setForm({ mode: 'add', date: tab === 'weeks' && week && !(today >= week.start && today <= week.end) ? week.start : today })
      } else if (tab === 'weeks' && key === 'arrowleft') stepWeek(-1)
      else if (tab === 'weeks' && key === 'arrowright') stepWeek(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Confetti when a tick change completes a day (small) or a whole week (big).
  // nextIsDone says what isDone will be after the change. Undo calls undo() directly,
  // not these, so undoing never celebrates.
  function celebrate(nextIsDone) {
    const ids = (list) => list.flatMap((d) => d.tasks.map((t) => t.id))
    const big = newlyCompleted(weeks.map((w) => ids(w.days)), isDone, nextIsDone)
    if (big || newlyCompleted(days.map((d) => ids([d])), isDone, nextIsDone)) setConfetti((prev) => ({ id: (prev?.id ?? 0) + 1, big }))
  }
  function toggleAndCelebrate(id) {
    celebrate((x) => (x === id ? !isDone(id) : isDone(x)))
    toggle(id)
  }
  function setManyAndCelebrate(ids, value, message) {
    const changed = new Set(ids)
    celebrate((x) => (changed.has(x) ? value : isDone(x)))
    setMany(ids, value, message)
  }

  // Shared with every component below through PlanContext (see PlanContext.js).
  const actions = { plan, savePlan, isDone, toggle: toggleAndCelebrate, setMany: setManyAndCelebrate, openTaskForm: setForm }

  return (
    <PlanContext.Provider value={actions}>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar
          now={now}
          view={tab}
          onChangeView={changeTab}
          collapsed={collapsed}
          onToggle={toggleSidebar}
          onNewMonth={() => setWizardOpen(true)}
          summary={planSummary(plan, today, isDone)}
          onMissedClick={() => goTo('today', { anchor: 'catch-up' })}
        >
          <MiniCalendar today={today} onPick={goToDate} />
        </Sidebar>

      <main className="flex-1 min-w-0 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-end -mb-2">
            <Menu onImport={() => setImporting(true)} onResetAll={resetAll} />
          </div>

          {saveError && (
            <p className="mb-4 rounded-xl bg-amber-100 text-amber-800 text-sm px-4 py-3 whitespace-pre-line">{saveError}</p>
          )}

          {/* viewTransitionName tells the browser this box is the "page" that slides.
              The side panel stays outside it, so it doesn't move. */}
          <div style={{ viewTransitionName: 'page' }}>
            {/* key: when the key changes, React throws the old element away and mounts
                a new one, so the fade-in animations replay on every view/week switch. */}
            {tab === 'today' ? (
              <TodayView key="today" days={days} now={now} />
            ) : tab === 'months' ? (
              <MonthsView
                key="months"
                today={today}
                onPickDate={goToDate}
                onOpenWeek={(w) => goTo('weeks', { week: weeks.findIndex((x) => x.id === w.id) })}
                onAddMonth={() => setWizardOpen(true)}
              />
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
            Shortcuts: <kbd>T</kbd> Today · <kbd>W</kbd> Weeks · <kbd>M</kbd> Months · <kbd>←</kbd> <kbd>→</kbd> week ·{' '}
            <kbd>N</kbd> add task · <kbd>[</kbd> panel
          </p>
        </div>
      </main>
      </div>

      {form && <TaskForm key={JSON.stringify(form)} form={form} onClose={() => setForm(null)} />}
      {importing && <ImportPanel onClose={() => setImporting(false)} />}
      {wizardOpen && (
        <MonthWizard
          today={today}
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            setWizardOpen(false)
            changeTab('months')
          }}
        />
      )}
      <Toast toast={toast} onUndo={undo} onClose={closeToast} />
      {/* key: a new burst id remounts Confetti, so fast completions each get their own burst. */}
      {confetti && <Confetti key={confetti.id} big={confetti.big} onDone={() => setConfetti(null)} />}
    </PlanContext.Provider>
  )
}

export default Tracker
