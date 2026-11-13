// Shared helpers for reading plan.json: today's date, flattening days,
// and the small calculations behind the Today view (streak, catch-up).

// Today's date as YYYY-MM-DD, matching the format used everywhere in plan.json.
export function todayString() {
  return new Date().toISOString().slice(0, 10)
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
