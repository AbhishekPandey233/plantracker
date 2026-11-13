// Logic behind the New month wizard. A "draft" is everything typed so far:
// { step, title, start, weekCount, weeks: [{ start, end, title, goal, days: [{ date, focus, tasks: [...] }] }] }
// Saving turns the draft into the "Import from Claude" format and reuses importIntoPlan,
// so ids, validation and month/week creation work exactly like an import.
import { addDays, mondayOf } from './planHelpers.js'
import { IMPORT_FORMAT_FOR_CLAUDE, ImportError, importIntoPlan } from './planImport.js'
import { isValidDate } from './validatePlan.js'

// A fresh draft starting the day after the last month ends.
export function newDraft(plan, today) {
  const last = plan.months.map((m) => m.end).sort().at(-1)
  return { step: 1, title: '', start: last ? addDays(last, 1) : today, weekCount: 4, weeks: [] }
}

// Week dates for a month: the first week runs to Sunday (shorter if start isn't a Monday),
// then full Monday-to-Sunday weeks.
export function wizardWeeks(start, count) {
  const weeks = []
  let weekStart = start
  for (let i = 0; i < count; i++) {
    const end = addDays(mondayOf(weekStart), 6)
    weeks.push({ start: weekStart, end })
    weekStart = addDays(end, 1)
  }
  return weeks
}

// Existing months that overlap start..end.
export function overlappingMonths(plan, start, end) {
  return plan.months.filter((m) => m.start <= end && start <= m.end)
}

// Rebuilds the draft's weeks and days from its start date and week count, keeping
// whatever was already typed (week titles/goals by position, days by date).
export function syncDraft(draft, plan) {
  if (!isValidDate(draft.start)) return draft
  const oldDays = new Map(draft.weeks.flatMap((w) => w.days).map((d) => [d.date, d]))
  const weekCount = plan.months.flatMap((m) => m.weeks).length
  const weeks = wizardWeeks(draft.start, draft.weekCount).map((range, i) => {
    const old = draft.weeks[i]
    const days = []
    for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
      days.push(oldDays.get(date) ?? { date, focus: '', tasks: [] })
    }
    return { ...range, title: old?.title ?? `Week ${weekCount + i + 1}: `, goal: old?.goal ?? '', days }
  })
  return { ...draft, weeks }
}

// Abhishek's usual shape of a day, with empty text to fill in.
export function usualPattern(date) {
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay() // 0 = Sunday, 6 = Saturday
  const task = (type, time) => ({ type, time, text: '', resources: '' })
  if (weekday === 6) return [task('project', '3 hrs')]
  if (weekday === 0) return [task('review', '')]
  return [task('learn', '07:00-08:30'), task('practise', 'Work hour')]
}

// Adds the usual pattern to every day that has no tasks yet.
export function fillWithPattern(draft) {
  return {
    ...draft,
    weeks: draft.weeks.map((w) => ({
      ...w,
      days: w.days.map((d) => (d.tasks.length ? d : { ...d, tasks: usualPattern(d.date) })),
    })),
  }
}

// The draft in the Import format. Tasks with empty text are left out.
export function draftToImport(draft) {
  return {
    weeks: draft.weeks.map((w) => ({ monthTitle: draft.title.trim(), title: w.title.trim(), start: w.start, end: w.end, goal: w.goal.trim() })),
    tasks: draft.weeks.flatMap((w) =>
      w.days.flatMap((d) =>
        d.tasks
          .filter((t) => t.text.trim())
          .map((t) => ({ date: d.date, type: t.type, time: t.time.trim(), text: t.text.trim(), resources: t.resources.trim() })),
      ),
    ),
  }
}

// Tries to add the draft to the plan. Returns { plan } or { problems: [...] }. Saves nothing.
export function buildMonth(plan, draft) {
  const problems = []
  if (!draft.title.trim()) problems.push('The month needs a title.')
  if (plan.months.some((m) => m.title === draft.title.trim())) problems.push(`A month called "${draft.title.trim()}" already exists.`)
  const end = draft.weeks.at(-1)?.end
  if (!draft.weeks.length) problems.push('The month needs at least one week.')
  else {
    for (const m of overlappingMonths(plan, draft.start, end)) problems.push(`The dates overlap "${m.title}" (${m.start} to ${m.end}).`)
    draft.weeks.forEach((w, i) => !w.title.trim() && problems.push(`Week ${i + 1} needs a title.`))
  }
  if (problems.length) return { problems }

  try {
    const next = importIntoPlan(plan, draftToImport(draft)).plan
    // The Import format has no day "focus", so copy it over for days that have tasks.
    const focus = new Map(draft.weeks.flatMap((w) => w.days).map((d) => [d.date, d.focus.trim()]))
    for (const month of next.months) {
      for (const week of month.weeks) for (const day of week.days) if (focus.get(day.date)) day.focus = focus.get(day.date)
    }
    return { plan: next }
  } catch (err) {
    if (err instanceof ImportError) return { problems: err.problems }
    throw err
  }
}

// "Month 2 · 4 weeks · 28 days · 48 tasks"
export function draftSummary(draft) {
  const days = draft.weeks.reduce((n, w) => n + w.days.length, 0)
  const tasks = draftToImport(draft).tasks.length
  const name = draft.title.split(':')[0].trim() || 'New month'
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
  return `${name} · ${plural(draft.weeks.length, 'week')} · ${plural(days, 'day')} · ${plural(tasks, 'task')}`
}

// The prompt for "Ask Claude to fill it".
export function claudePrompt(draft) {
  const weeks = draft.weeks
    .map((w) => `- ${w.title.trim()} (${w.start} to ${w.end})${w.goal.trim() ? `. Goal: ${w.goal.trim()}` : ''}`)
    .join('\n')
  return `I'm planning the next month of my study plan. Please fill in a task for every day.

Month: ${draft.title.trim()}
Weeks:
${weeks}

My usual pattern:
- Monday to Friday: a "learn" task at "07:00-08:30" and a "practise" task at "Work hour".
- Saturday: a "project" task at "3 hrs".
- Sunday: a "review" task.

Use the week titles, dates and goals above exactly (put them in "weeks", with "monthTitle": "${draft.title.trim()}"), and give every task a short, specific "text" and useful "resources".

${IMPORT_FORMAT_FOR_CLAUDE}

Reply with the JSON only, no explanation and no code fence.`
}

// Fills the draft's days (and week titles/goals) from Claude's pasted reply.
// Tasks for a date replace that day's tasks. Returns { draft, problems, count }.
export function applyClaudeReply(draft, text) {
  let input
  try {
    // Claude sometimes wraps JSON in ```json fences anyway; strip them.
    input = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch (err) {
    return { draft, problems: [`That isn't valid JSON: ${err.message}`], count: 0 }
  }
  const problems = []
  const byDate = new Map()
  for (const [i, t] of (Array.isArray(input?.tasks) ? input.tasks : []).entries()) {
    if (!draft.weeks.some((w) => w.days.some((d) => d.date === t?.date))) {
      problems.push(`Task ${i + 1} ("${t?.text ?? '?'}"): ${t?.date} isn't in this month, skipped.`)
      continue
    }
    const task = { type: t.type ?? 'learn', time: String(t.time ?? ''), text: String(t.text ?? ''), resources: String(t.resources ?? '') }
    byDate.set(t.date, [...(byDate.get(t.date) ?? []), task])
  }
  const replyWeeks = new Map((Array.isArray(input?.weeks) ? input.weeks : []).map((w) => [w?.start, w]))
  const next = {
    ...draft,
    weeks: draft.weeks.map((w) => {
      const rw = replyWeeks.get(w.start)
      return {
        ...w,
        title: typeof rw?.title === 'string' ? rw.title : w.title,
        goal: typeof rw?.goal === 'string' ? rw.goal : w.goal,
        days: w.days.map((d) => (byDate.has(d.date) ? { ...d, tasks: byDate.get(d.date) } : d)),
      }
    }),
  }
  const count = [...byDate.values()].reduce((n, list) => n + list.length, 0)
  if (!count && !problems.length) problems.push('No tasks found in the reply.')
  return { draft: next, problems, count }
}
