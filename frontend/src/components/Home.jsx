import { useEffect, useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { useCountUp } from '../hooks/useCountUp'
import { api } from '../utils/api'
import { addDays, journey, nextUnfinishedTask, shortDate, todayString } from '../utils/planHelpers'
import { formatClock, greeting, kathmanduParts } from '../utils/timeHelpers'

const INTRO_KEY = 'planTracker:homeIntroSeen'
const card = 'animate-fade-up bg-white rounded-2xl shadow-sm p-5'
const action = 'rounded-xl bg-white shadow-sm px-4 py-3 text-sm font-semibold text-slate-700 hover:shadow-md active:scale-95 transition'

// True the first time Home opens in this browser tab (sessionStorage is per tab and
// cleared when it closes). Later visits get the quick version of the intro.
function firstVisit() {
  try {
    const seen = sessionStorage.getItem(INTRO_KEY)
    sessionStorage.setItem(INTRO_KEY, '1')
    return !seen
  } catch {
    return true // storage blocked: just play the full intro
  }
}

// The overall progress ring. The circle is drawn at its final value; the ring-in
// animation turns it into place (transform only, no stroke animation).
function Ring({ pct }) {
  return (
    <svg viewBox="0 0 120 120" className="animate-ring-in h-32 w-32 -rotate-90 shrink-0" style={{ animationDelay: 'inherit' }}>
      <circle cx="60" cy="60" r="50" fill="none" strokeWidth="12" className="stroke-slate-200" />
      {/* pathLength=100: the dash length is the percentage, whatever the real circle length. */}
      {/* Skipped at 0%: the round line cap would still draw a dot. */}
      {pct > 0 && (
        <circle cx="60" cy="60" r="50" fill="none" strokeWidth="12" strokeLinecap="round" pathLength="100"
          strokeDasharray={`${pct} 100`} className="stroke-teal-600" />
      )}
    </svg>
  )
}

// The Home page (the app opens here). Props from Tracker: the clock, the flat list of
// days, the side panel's summary numbers, and what each button does.
function Home({ now, days, summary, onStartToday, onLookBack, onAddMonth, onImport, onOpenDay }) {
  const { plan, isDone } = usePlanActions()
  // useState with a function: runs once, so the intro choice doesn't change while Home is open.
  const [full] = useState(firstVisit)
  const [yesterdayEntry, setYesterdayEntry] = useState(null) // null while loading

  const today = todayString(now)
  const yesterday = addDays(today, -1)
  const todayDay = days.find((d) => d.date === today)
  const todayDone = todayDay?.tasks.length > 0 && todayDay.tasks.every((t) => isDone(t.id))
  const next = nextUnfinishedTask(days, today, isDone)
  const { stops, position } = journey(plan, today)
  const s = summary
  const pct = s.plannedDays ? Math.round((s.completedDays / s.plannedDays) * 100) : 0

  // Full intro: slow stagger and count-ups. Later visits: quick.
  const countMs = full ? 1200 : 300
  const delay = (i) => ({ animationDelay: `${i * (full ? 110 : 25)}ms` })
  const shownPct = useCountUp(pct, countMs)
  const shownDone = useCountUp(s.completedDays, countMs)
  const shownLeft = useCountUp(s.plannedLeft, countMs)

  // Load yesterday's journal once (for "Yesterday you learned").
  useEffect(() => {
    api(`/api/journal/${yesterday}`)
      .then(setYesterdayEntry)
      .catch(() => setYesterdayEntry({ exists: false }))
  }, [yesterday])

  const learned = yesterdayEntry?.exists && yesterdayEntry.learned.trim().split('\n')[0]

  return (
    <div className="space-y-4">
      {/* 1. Hero */}
      <section className={`${card} text-center py-8`} style={delay(0)}>
        <p className="text-sm font-medium text-slate-500 tabular-nums">{formatClock(now)}</p>
        <h1 className="text-3xl font-bold text-slate-800 mt-1">{greeting(kathmanduParts(now).minutes)}, Abhishek</h1>
        {todayDay?.focus && <p className="text-slate-500 mt-1">Today: {todayDay.focus}</p>}
        <button
          onClick={todayDone ? onLookBack : onStartToday}
          className="animate-pop mt-5 text-lg font-semibold text-white bg-teal-600 rounded-full px-8 py-3 shadow-md hover:shadow-lg active:scale-95 transition"
          style={delay(2)}
        >
          {todayDone ? "Today's done — look back?" : 'Start today →'}
        </button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 2. Overall progress */}
        <section className={`${card} flex items-center gap-5`} style={delay(1)}>
          <div className="relative" style={delay(3)}>
            <Ring pct={pct} />
            <span className="absolute inset-0 grid place-items-center text-2xl font-bold text-slate-800 tabular-nums">{shownPct}%</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Whole plan</p>
            <p className="text-slate-700"><span className="text-xl font-bold tabular-nums">{shownDone}</span> days done</p>
            <p className="text-slate-700"><span className="text-xl font-bold tabular-nums">{shownLeft}</span> days left</p>
          </div>
        </section>

        {/* 3. Streak */}
        <section className={`${card} flex items-center gap-4`} style={delay(2)}>
          <span className={`text-5xl ${s.streak > 0 ? 'animate-flame' : 'opacity-30 grayscale'}`} aria-hidden="true">🔥</span>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Streak</p>
            <p className="text-slate-700"><span className="text-3xl font-bold text-amber-600 tabular-nums">{s.streak}</span> {s.streak === 1 ? 'day' : 'days'}</p>
            <p className="text-sm text-slate-500">Best: {s.bestStreak}</p>
          </div>
        </section>
      </div>

      {/* 4. Six-month journey: the line draws itself, then the stops pop in. */}
      {stops.length > 0 && (
        <section className={card} style={delay(3)}>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-6">{stops.length}-month journey</p>
          <div className="relative mx-3 mb-2 h-14">
            <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-slate-200 animate-draw-x" style={delay(3)} />
            <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-teal-600 animate-draw-x" style={{ ...delay(5), transform: `scaleX(${position})` }} />
            {/* "You are here": placed with left %, then only popped in (transform). */}
            <div className="absolute top-0 -ml-2.5 h-7 w-5 animate-pop" style={{ ...delay(8), left: `${position * 100}%` }} title={`Today: ${shortDate(today)}`}>
              <div className="h-5 w-5 mt-1 rounded-full bg-teal-600 ring-4 ring-teal-400/40" />
            </div>
            {stops.map((stop, i) => {
              const left = stops.length === 1 ? 0 : (i / (stops.length - 1)) * 100
              return (
                <div key={i} className="absolute top-1.5 -ml-2 w-4 animate-pop" style={{ ...delay(5 + i), left: `${left}%` }}>
                  {stop.planned ? (
                    <div title={stop.title} className={`h-4 w-4 rounded-full border-2 ${stop.passed || stop.current ? 'bg-teal-600 border-teal-600' : 'bg-white border-teal-600'}`} />
                  ) : (
                    <button onClick={onAddMonth} title="Add month" aria-label={`Add month ${i + 1}`} className="h-4 w-4 rounded-full border-2 border-dashed border-slate-400 bg-white hover:border-teal-500 transition active:scale-90" />
                  )}
                  <span className={`absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] ${stop.current ? 'font-semibold text-teal-600' : 'text-slate-500'}`}>
                    {stop.planned ? `M${i + 1}` : '+ Add'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 5. Continue where you left off */}
        <section className={card} style={delay(4)}>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Continue where you left off</p>
          {s.missedDays > 0 && <p className="text-sm text-red-700 font-semibold mb-1">{s.missedDays} {s.missedDays === 1 ? 'day' : 'days'} to catch up</p>}
          {next ? (
            <button onClick={() => onOpenDay(next.date)} className="text-left w-full rounded-lg -mx-2 px-2 py-1 hover:bg-slate-50 transition active:scale-[0.98]">
              <p className="text-xs text-slate-500">{next.date === today ? 'Today' : shortDate(next.date)}</p>
              <p className="text-slate-800 font-medium line-clamp-2">{next.task.text}</p>
            </button>
          ) : (
            <p className="text-slate-500 text-sm">Nothing left to do. Add the next month?</p>
          )}
        </section>

        {/* 6. Yesterday (plain text: React escapes it) */}
        <section className={card} style={delay(5)}>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Yesterday</p>
          {yesterdayEntry === null ? null : learned ? (
            <p className="text-slate-700 text-sm line-clamp-3">You learned: {learned}</p>
          ) : (
            <button onClick={() => onOpenDay(yesterday)} className="text-sm text-teal-600 font-semibold hover:underline">
              No journal yet — write what you learned →
            </button>
          )}
        </section>
      </div>

      {/* 7. Quick actions */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Start today', onStartToday],
          ['Look back', onLookBack],
          ['Add month', onAddMonth],
          ['Import from Claude', onImport],
        ].map(([label, onClick], i) => (
          <button key={label} onClick={onClick} className={`${action} animate-fade-up`} style={delay(6 + i)}>
            {label}
          </button>
        ))}
      </section>
    </div>
  )
}

export default Home
