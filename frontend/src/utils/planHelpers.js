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

// Days in a row with every task ticked. Counts back from yesterday, then
// adds today itself once today's own tasks are all ticked.
export function computeStreak(days, today, isDone) {
  const byDate = new Map(days.map((d) => [d.date, d]))

  function isFullyDone(dateStr) {
    const day = byDate.get(dateStr)
    return Boolean(day) && day.tasks.length > 0 && day.tasks.every((t) => isDone(t.id))
  }

  let streak = isFullyDone(today) ? 1 : 0
  const cursor = new Date(today + 'T00:00:00Z')
  for (;;) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    if (!isFullyDone(cursor.toISOString().slice(0, 10))) break
    streak++
  }
  return streak
}

// Combines two sets of ticks ({ "task-id": true/false }).
// A task ticked on either side stays ticked.
export function mergeTicks(a, b) {
  const merged = { ...a }
  for (const [id, done] of Object.entries(b)) merged[id] = Boolean(merged[id] || done)
  return merged
}
