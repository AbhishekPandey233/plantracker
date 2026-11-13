// Import from Claude: takes pasted JSON ({ tasks, weeks, routine }) and merges it
// into the plan. Returns { plan, summary } or throws an ImportError listing every problem.
// Nothing is saved here; the Import panel shows the summary first.
import { ensureDay, newMonthId, newWeekId } from './planEdit.js'
import { allTasks } from './planHelpers.js'
import { ROUTINE_TEMPLATES, TASK_TYPES, isValidDate, validatePlan } from './validatePlan.js'

export class ImportError extends Error {
  constructor(problems) {
    super(problems.join('\n'))
    this.problems = problems
  }
}

// Short description of the format, for the "Copy format for Claude" button.
export const IMPORT_FORMAT_FOR_CLAUDE = `Please reply with JSON in this format for my Plan Tracker app (any of the three keys can be left out):

{
  "tasks": [
    { "date": "2026-12-21", "type": "learn", "time": "07:00-08:30",
      "text": "JavaScript functions and arrow functions", "resources": "MDN" }
  ],
  "weeks": [
    { "monthTitle": "Month 2: JavaScript, React, full-stack",
      "title": "Week 6: JavaScript basics", "start": "2026-12-21", "end": "2026-12-27",
      "goal": "Comfortable with functions, arrays, objects, the DOM and fetch." }
  ],
  "routine": {
    "weekday": [
      { "id": "coding-morning", "start": "07:00", "end": "08:30", "label": "Coding: learn",
        "kind": "coding", "taskType": "learn", "tickable": true }
    ]
  }
}

Rules:
- Dates are YYYY-MM-DD. Weeks run Monday to Sunday.
- Task "type" is one of: ${TASK_TYPES.join(', ')}.
- "time" is optional: "HH:MM-HH:MM" or free text like "Work hour".
- Routine template names: ${ROUTINE_TEMPLATES.join(', ')}. A template replaces my whole current template.
- Routine block times are HH:MM (24-hour); "end" is optional for one-moment blocks like wake up and sleep.
- Block "kind" is one of: wake, coding, french, work, meal, rest, fun, sleep. Blocks must not overlap.
- Don't include task ids; the app creates them.`

// "Coding: learn" -> "coding-learn"
function slug(text) {
  return String(text ?? 'block').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'block'
}

// Id for a new plan task: <date>-<type>, or with -2, -3 if that's taken.
function freeTaskId(used, date, type) {
  let id = `${date}-${type}`
  for (let n = 2; used.has(id); n++) id = `${date}-${type}-${n}`
  return id
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function importIntoPlan(plan, input) {
  if (!isObject(input)) throw new ImportError(['Paste a JSON object with "tasks", "weeks" and/or "routine".'])
  const unknownKeys = Object.keys(input).filter((k) => !['tasks', 'weeks', 'routine'].includes(k))
  if (unknownKeys.length) throw new ImportError([`Unknown key(s): ${unknownKeys.join(', ')}. Use tasks, weeks and routine.`])

  const problems = []
  const next = structuredClone(plan)
  const summary = { tasks: [], newWeeks: [], updatedWeeks: [], routine: [] }

  // 1. Weeks first, so tasks on those dates land in them.
  const weeks = input.weeks ?? []
  if (!Array.isArray(weeks)) problems.push('"weeks" must be a list')
  else {
    weeks.forEach((w, i) => {
      const where = `Week ${i + 1} ("${w?.title ?? '?'}")`
      if (!isObject(w)) return problems.push(`${where}: must be an object`)
      if (!isValidDate(w.start) || !isValidDate(w.end)) return problems.push(`${where}: start and end must be YYYY-MM-DD dates`)
      if (typeof w.title !== 'string' || !w.title.trim()) return problems.push(`${where}: title is missing`)

      const existing = next.months.flatMap((m) => m.weeks).find((x) => x.start === w.start)
      if (existing) {
        existing.title = w.title
        if (typeof w.goal === 'string') existing.goal = w.goal
        summary.updatedWeeks.push(w.title)
        return
      }

      const monthTitle = typeof w.monthTitle === 'string' && w.monthTitle.trim() ? w.monthTitle : null
      let month = monthTitle
        ? next.months.find((m) => m.title === monthTitle)
        : next.months.find((m) => m.start <= w.start && w.start <= m.end)
      if (!month) {
        month = { id: newMonthId(next), title: monthTitle ?? `Month ${next.months.length + 1}`, start: w.start, end: w.end, weeks: [] }
        next.months.push(month)
        next.months.sort((a, b) => (a.start < b.start ? -1 : 1))
      }
      // Stretch the month to cover the week.
      if (w.start < month.start) month.start = w.start
      if (w.end > month.end) month.end = w.end

      month.weeks.push({ id: newWeekId(next, month), title: w.title, start: w.start, end: w.end, goal: w.goal ?? '', days: [] })
      month.weeks.sort((a, b) => (a.start < b.start ? -1 : 1))
      summary.newWeeks.push(w.title)
    })
  }

  // 2. Tasks.
  const tasks = input.tasks ?? []
  const usedIds = new Set(allTasks(next).map((t) => t.id))
  if (!Array.isArray(tasks)) problems.push('"tasks" must be a list')
  else {
    tasks.forEach((t, i) => {
      const where = `Task ${i + 1} ("${t?.text ?? '?'}")`
      if (!isObject(t)) return problems.push(`${where}: must be an object`)
      if (!isValidDate(t.date)) return problems.push(`${where}: date "${t.date}" must be YYYY-MM-DD`)
      if (!TASK_TYPES.includes(t.type)) return problems.push(`${where}: type "${t.type}" must be one of ${TASK_TYPES.join(', ')}`)
      if (typeof t.text !== 'string' || !t.text.trim()) return problems.push(`${where}: text is missing`)
      // Existing ids are never changed or reused.
      if (t.id !== undefined && usedIds.has(t.id)) return problems.push(`${where}: id "${t.id}" already exists`)

      const id = t.id ?? freeTaskId(usedIds, t.date, t.type)
      usedIds.add(id)
      const task = { id, type: t.type, time: t.time ?? '', text: t.text.trim(), resources: t.resources ?? '' }
      ensureDay(next, t.date).tasks.push(task)
      summary.tasks.push({ ...task, date: t.date })
    })
  }

  // 3. Routine: each named template replaces the current one. Blocks without an id
  //    keep the id of the matching current block (same label, or same start and kind).
  const routine = input.routine ?? {}
  if (!isObject(routine)) problems.push('"routine" must be an object like { "weekday": [blocks] }')
  else {
    for (const [name, blocks] of Object.entries(routine)) {
      if (!ROUTINE_TEMPLATES.includes(name)) {
        problems.push(`Routine "${name}": must be one of ${ROUTINE_TEMPLATES.join(', ')}`)
        continue
      }
      if (!Array.isArray(blocks)) {
        problems.push(`Routine "${name}" must be a list of blocks`)
        continue
      }
      const current = next.routine?.[name] ?? []
      next.routine ??= {}
      next.routine[name] = blocks.map((b) => {
        const match = current.find((c) => c.label === b?.label) ?? current.find((c) => c.start === b?.start && c.kind === b?.kind)
        const block = { id: b?.id ?? match?.id ?? slug(b?.label), start: b?.start }
        if (b?.end !== undefined) block.end = b.end
        Object.assign(block, { label: b?.label, kind: b?.kind })
        if (b?.taskType !== undefined) block.taskType = b.taskType
        block.tickable = b?.tickable ?? false
        return block
      })
      summary.routine.push(name)
    }
  }

  // 4. The whole result must pass the same checks as plan.json.
  if (!problems.length) problems.push(...validatePlan(next, { quiet: true }))
  if (problems.length) throw new ImportError(problems)

  summary.tasks.sort((a, b) => (a.date < b.date ? -1 : 1))
  return { plan: next, summary }
}
