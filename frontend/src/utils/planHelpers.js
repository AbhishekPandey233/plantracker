// Shared helpers for reading plan.json: today's date, flattening days,
// and the small calculations behind the Today view (streak, catch-up).
import { TIME_ZONE, currentMoment } from './timeHelpers.js'

// Today's date in Kathmandu (Nepal, UTC+5:45) as YYYY-MM-DD, the format used in plan.json.
// Pinned to Asia/Kathmandu, so it's right even if the laptop's time zone setting changes.
// Not toISOString(): that gives the UTC date, which is still "yesterday" until 5:45 am.
// The en-CA locale happens to format dates as YYYY-MM-DD.
export function todayString(moment = currentMoment()) {
  return moment.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

// Adds days to a YYYY-MM-DD date: addDays('2026-11-30', 1) -> '2026-12-01'.
export function addDays(date, days) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// The Monday of the week a date is in.
export function mondayOf(date) {
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay() // 0 = Sunday
  return addDays(date, weekday === 0 ? -6 : 1 - weekday)
}

// Every task in the plan, each with its date: [{ ...task, date }].
export function allTasks(plan) {
  return flattenDays(plan).flatMap((day) => day.tasks.map((task) => ({ ...task, date: day.date })))
}

// Flattens months -> weeks -> days into one list. Each day keeps a
// reference to its week and month, so progress bars can total them up.
export function flattenDays(plan) {
  const days = []
  for (const month of plan.months) {
    for (const week of month.weeks) {
      for (const day of week.days) {
        days.push({ ...day, week, month })
      }
    }
  }
  return days
}

// Picks what the Today view should show: today's own day if it has one,
// otherwise the next day that does. Also collects unticked tasks from
// earlier days as "catch up".
export function getTodayContext(days, today, isDone) {
  const targetDay = days.find((d) => d.date === today) ?? days.find((d) => d.date > today)

  const catchUpTasks = days
    .filter((d) => d.date < today)
    .flatMap((d) => d.tasks.filter((t) => !isDone(t.id)).map((t) => ({ ...t, date: d.date })))

  return { targetDay, catchUpTasks }
}

// Status of one date (see BUILD_PLAN_3 "Definitions"). "day" is the plan day for
// that date, or undefined. Only plan tasks count; routine ticks don't.
//   complete, partial (past/today), missed (past, nothing ticked), today, upcoming, empty
export function dayStatus(day, date, today, isDone) {
  const tasks = day?.tasks ?? []
  if (tasks.length === 0) return 'empty'
  const done = tasks.filter((t) => isDone(t.id)).length
  if (done === tasks.length) return 'complete'
  if (date > today) return 'upcoming'
  if (done > 0) return 'partial'
  return date === today ? 'today' : 'missed'
}

// Days with at least one task, oldest first.
function planDays(days) {
  return days.filter((d) => d.tasks.length > 0).sort((a, b) => (a.date < b.date ? -1 : 1))
}

const isComplete = (day, isDone) => day.tasks.every((t) => isDone(t.id))

// Plan days in a row with every task ticked, counting back from yesterday, plus
// today once today's own tasks are all ticked. Dates without tasks (rest days,
// gaps between months) are skipped, so they don't break the streak.
export function computeStreak(days, today, isDone) {
  let streak = 0
  for (const day of planDays(days).filter((d) => d.date <= today).reverse()) {
    if (isComplete(day, isDone)) streak++
    else if (day.date !== today) break // an unfinished today doesn't break it yet
  }
  return streak
}

// The longest run of complete plan days ever (up to today), with the same rules.
export function bestStreak(days, today, isDone) {
  let best = 0
  let run = 0
  for (const day of planDays(days).filter((d) => d.date <= today)) {
    run = isComplete(day, isDone) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

// Whole days from one YYYY-MM-DD date to another (negative if "to" is earlier).
export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)
}

// "Thu 3 Dec" for a YYYY-MM-DD date.
export function shortDate(date) {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
}

// Calendar rows (Monday to Sunday) covering start..end: [['2026-11-30', ... 7 dates], ...].
export function calendarRows(start, end) {
  const rows = []
  for (let monday = mondayOf(start); monday <= end; monday = addDays(monday, 7)) {
    rows.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)))
  }
  return rows
}

// First and last date of a calendar month 'YYYY-MM', plus the month `offset` months away.
export function monthBounds(yearMonth, offset = 0) {
  const [y, m] = yearMonth.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + offset, 1))
  const last = new Date(Date.UTC(y, m + offset, 0)) // day 0 of next month = last day of this one
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
}

// Numbers for the side panel's progress summary.
export function planSummary(plan, today, isDone) {
  const days = flattenDays(plan)
  const counts = { complete: 0, partial: 0, missed: 0, today: 0, upcoming: 0 }
  let plannedLeft = 0
  for (const day of planDays(days)) {
    const status = dayStatus(day, day.date, today, isDone)
    counts[status]++
    if (day.date >= today && status !== 'complete') plannedLeft++
  }
  const meta = plan.meta ?? {}
  return {
    plannedDays: planDays(days).length,
    completedDays: counts.complete,
    missedDays: counts.missed,
    plannedLeft,
    targetEnd: meta.targetEnd ?? null,
    daysToTarget: meta.targetEnd ? Math.max(0, daysBetween(today, meta.targetEnd)) : null,
    streak: computeStreak(days, today, isDone),
    bestStreak: bestStreak(days, today, isDone),
    monthsPlanned: plan.months.length,
    targetMonths: meta.targetMonths ?? null,
  }
}

// Combines two sets of ticks ({ "task-id": true/false }).
// A task ticked on either side stays ticked.
export function mergeTicks(a, b) {
  const merged = { ...a }
  for (const [id, done] of Object.entries(b)) merged[id] = Boolean(merged[id] || done)
  return merged
}

// True if any group of task ids (a day's or a week's tasks) becomes fully ticked
// when the ticks change from isDone to nextIsDone. Used for the confetti.
export function newlyCompleted(groups, isDone, nextIsDone) {
  return groups.some((ids) => ids.length > 0 && !ids.every(isDone) && ids.every(nextIsDone))
}

// Ticked and total plan tasks per type: { learn: { done, total }, ... }.
export function tasksByType(plan, isDone) {
  const result = {}
  for (const task of allTasks(plan)) {
    result[task.type] ??= { done: 0, total: 0 }
    result[task.type].total++
    if (isDone(task.id)) result[task.type].done++
  }
  return result
}
