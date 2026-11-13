// Checks for plan.json and progress.json. Used by the browser, by `npm run validate`,
// by the local data API before it saves anything, and by the import.

export const TASK_TYPES = ['learn', 'practise', 'project', 'review', 'french', 'personal']
export const ROUTINE_TEMPLATES = ['weekday', 'saturday', 'sunday']
export const ROUTINE_KINDS = ['wake', 'coding', 'french', 'work', 'meal', 'rest', 'fun', 'sleep']

// True only for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30).
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !isNaN(d) && d.toISOString().slice(0, 10) === s
}

// True for a 24-hour time like "07:00" or "22:30".
export function isValidTime(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

// Checks plan.json for mistakes. Returns a list of warning strings.
// Also logs each one to the console, unless called with { quiet: true }.
export function validatePlan(plan, { quiet = false } = {}) {
  const warnings = []
  const seenIds = new Set()
  const allWeeks = []

  // A list that should be an array but isn't becomes a warning instead of a crash.
  function list(value, label) {
    if (value === undefined) return []
    if (Array.isArray(value)) return value
    warnings.push(`${label} must be a list`)
    return []
  }

  // Checks one start/end pair. YYYY-MM-DD strings compare correctly as text.
  function checkRange(label, start, end) {
    if (!isValidDate(start)) warnings.push(`${label}: invalid start date "${start}"`)
    if (!isValidDate(end)) warnings.push(`${label}: invalid end date "${end}"`)
    if (isValidDate(start) && isValidDate(end) && start > end) {
      warnings.push(`${label}: start ${start} is after end ${end}`)
    }
  }

  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.months)) {
    warnings.push('plan must be an object with a "months" list')
  } else {
    for (const month of plan.months) {
      checkRange(`Month "${month?.id}"`, month?.start, month?.end)

      for (const week of list(month?.weeks, `Month "${month?.id}" weeks`)) {
        checkRange(`Week "${week?.id}"`, week?.start, week?.end)
        allWeeks.push(week)

        for (const day of list(week?.days, `Week "${week?.id}" days`)) {
          if (!isValidDate(day?.date)) {
            warnings.push(`Week "${week?.id}": invalid day date "${day?.date}"`)
          } else if (day.date < week.start || day.date > week.end) {
            warnings.push(`Day ${day.date} is outside its week "${week.id}" (${week.start} to ${week.end})`)
          }

          for (const task of list(day?.tasks, `Day ${day?.date} tasks`)) {
            if (typeof task?.id !== 'string' || !task.id) warnings.push(`A task on ${day?.date} has no id`)
            else if (seenIds.has(task.id)) warnings.push(`Duplicate task id "${task.id}" (on ${day.date})`)
            seenIds.add(task?.id)
            if (!TASK_TYPES.includes(task?.type)) {
              warnings.push(`Task "${task?.id}": type "${task?.type}" must be one of ${TASK_TYPES.join(', ')}`)
            }
            if (typeof task?.text !== 'string' || !task.text.trim()) warnings.push(`Task "${task?.id}" has no text`)
          }
        }
      }
    }

    // Two weeks covering the same date would make "which week is this day in?" ambiguous.
    const sorted = allWeeks.filter((w) => isValidDate(w?.start) && isValidDate(w?.end)).sort((a, b) => (a.start < b.start ? -1 : 1))
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start <= sorted[i - 1].end) {
        warnings.push(`Weeks "${sorted[i - 1].id}" and "${sorted[i].id}" overlap`)
      }
    }

    if (plan.routine !== undefined) warnings.push(...validateRoutine(plan.routine))
  }

  if (!quiet) for (const w of warnings) console.warn('[plan.json]', w)
  return warnings
}

// Checks the "routine" section: { weekday: [blocks], saturday: [...], sunday: [...] }.
function validateRoutine(routine) {
  const warnings = []
  if (!routine || typeof routine !== 'object' || Array.isArray(routine)) {
    return ['routine must be an object with weekday, saturday and sunday lists']
  }

  for (const [name, blocks] of Object.entries(routine)) {
    const label = `Routine "${name}"`
    if (!ROUTINE_TEMPLATES.includes(name)) {
      warnings.push(`${label}: name must be one of ${ROUTINE_TEMPLATES.join(', ')}`)
      continue
    }
    if (!Array.isArray(blocks)) {
      warnings.push(`${label} must be a list of blocks`)
      continue
    }

    const ids = new Set()
    const ranges = [] // [start, end] in minutes, for the overlap check
    for (const block of blocks) {
      const where = `${label} block "${block?.id}"`
      if (typeof block?.id !== 'string' || !/^[a-z0-9-]+$/.test(block.id)) {
        warnings.push(`${where}: id must be lowercase letters, numbers and dashes`)
      } else if (ids.has(block.id)) {
        warnings.push(`${where}: duplicate id`)
      }
      ids.add(block?.id)

      if (typeof block?.label !== 'string' || !block.label.trim()) warnings.push(`${where}: label is missing`)
      if (!ROUTINE_KINDS.includes(block?.kind)) {
        warnings.push(`${where}: kind "${block?.kind}" must be one of ${ROUTINE_KINDS.join(', ')}`)
      }
      if (block?.taskType !== undefined && !TASK_TYPES.includes(block.taskType)) {
        warnings.push(`${where}: taskType "${block.taskType}" must be one of ${TASK_TYPES.join(', ')}`)
      }
      if (block?.tickable !== undefined && typeof block.tickable !== 'boolean') {
        warnings.push(`${where}: tickable must be true or false`)
      }

      if (!isValidTime(block?.start)) {
        warnings.push(`${where}: start "${block?.start}" must be HH:MM`)
        continue
      }
      if (block.end !== undefined && !isValidTime(block.end)) {
        warnings.push(`${where}: end "${block.end}" must be HH:MM`)
        continue
      }
      if (block.end !== undefined && block.end <= block.start) {
        warnings.push(`${where}: end ${block.end} must be after start ${block.start}`)
        continue
      }
      // A block without an end (wake up, sleep) is a single moment.
      ranges.push({ id: block.id, start: block.start, end: block.end ?? block.start })
    }

    // Overlap: one block starts before another ends. Touching (08:30 end, 08:30 start) is fine.
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const a = ranges[i]
        const b = ranges[j]
        if (a.start < b.end && b.start < a.end) warnings.push(`${label}: blocks "${a.id}" and "${b.id}" overlap`)
      }
    }
  }
  return warnings
}

// Checks progress.json: an object like { "2026-11-18-learn": true }.
// Returns a list of problems (empty = fine).
export function validateProgress(progress) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    return ['progress must be an object like { "task-id": true }']
  }
  return Object.entries(progress)
    .filter(([, value]) => typeof value !== 'boolean')
    .map(([id]) => `progress "${id}" must be true or false`)
}
