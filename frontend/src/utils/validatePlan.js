const TYPES = ['learn', 'practise', 'project', 'review']

// True only for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30).
function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !isNaN(d) && d.toISOString().slice(0, 10) === s
}

// Checks plan.json for mistakes. Returns a list of warning strings
// and also logs each one to the browser console.
export function validatePlan(plan) {
  const warnings = []
  const seenIds = new Set()

  // Checks one start/end pair. YYYY-MM-DD strings compare correctly as text.
  function checkRange(label, start, end) {
    if (!isValidDate(start)) warnings.push(`${label}: invalid start date "${start}"`)
    if (!isValidDate(end)) warnings.push(`${label}: invalid end date "${end}"`)
    if (isValidDate(start) && isValidDate(end) && start > end) {
      warnings.push(`${label}: start ${start} is after end ${end}`)
    }
  }

  for (const month of plan.months ?? []) {
    checkRange(`Month "${month.id}"`, month.start, month.end)

    for (const week of month.weeks ?? []) {
      checkRange(`Week "${week.id}"`, week.start, week.end)

      for (const day of week.days ?? []) {
        if (!isValidDate(day.date)) {
          warnings.push(`Week "${week.id}": invalid day date "${day.date}"`)
        } else if (day.date < week.start || day.date > week.end) {
          warnings.push(`Day ${day.date} is outside its week "${week.id}" (${week.start} to ${week.end})`)
        }

        for (const task of day.tasks ?? []) {
          if (seenIds.has(task.id)) warnings.push(`Duplicate task id "${task.id}" (on ${day.date})`)
          seenIds.add(task.id)
          if (!TYPES.includes(task.type)) {
            warnings.push(`Task "${task.id}": type "${task.type}" must be one of ${TYPES.join(', ')}`)
          }
        }
      }
    }
  }

  for (const w of warnings) console.warn('[plan.json]', w)
  return warnings
}
