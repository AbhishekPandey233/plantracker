// Changes to the plan: add, edit, move and delete tasks.
// Every function takes a plan and returns a NEW plan (the old one is left untouched),
// which is how React state should be updated.
import { addDays, allTasks, mondayOf } from './planHelpers.js'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Keeps a list sorted when adding an item (by a date field like "start" or "date").
function insertSorted(list, item, field) {
  const index = list.findIndex((other) => other[field] > item[field])
  if (index === -1) list.push(item)
  else list.splice(index, 0, item)
}

function allWeeks(plan) {
  return plan.months.flatMap((month) => month.weeks)
}

// A month id like "m3" that isn't used yet.
export function newMonthId(plan) {
  let n = plan.months.length + 1
  while (plan.months.some((m) => m.id === `m${n}`)) n++
  return `m${n}`
}

// A week id like "m2-w4" that isn't used yet.
export function newWeekId(plan, month) {
  let n = month.weeks.length + 1
  while (allWeeks(plan).some((w) => w.id === `${month.id}-w${n}`)) n++
  return `${month.id}-w${n}`
}

// Shrinks a start/end range so it doesn't overlap the given ranges around `date`.
function clampRange(start, end, date, ranges) {
  for (const r of ranges) {
    if (r.end < date && r.end >= start) start = addDays(r.end, 1)
    if (r.start > date && r.start <= end) end = addDays(r.start, -1)
  }
  return { start, end }
}

// Finds the month for a date, or adds one covering that calendar month
// (e.g. "January 2027"), trimmed so it doesn't overlap other months.
export function ensureMonth(plan, date) {
  const found = plan.months.find((m) => m.start <= date && date <= m.end)
  if (found) return found
  const [year, month] = date.split('-').map(Number)
  const first = `${date.slice(0, 7)}-01`
  const last = addDays(month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`, -1)
  const range = clampRange(first, last, date, plan.months)
  const created = { id: newMonthId(plan), title: `${MONTH_NAMES[month - 1]} ${year}`, ...range, weeks: [] }
  insertSorted(plan.months, created, 'start')
  return created
}

// Finds the day for a date, creating the day, its week (Monday to Sunday,
// trimmed so it doesn't overlap other weeks) and its month if needed.
// Changes `plan` directly, so only call it on a copy.
export function ensureDay(plan, date) {
  let week = allWeeks(plan).find((w) => w.start <= date && date <= w.end)
  if (!week) {
    const monday = mondayOf(date)
    const range = clampRange(monday, addDays(monday, 6), date, allWeeks(plan))
    const month = ensureMonth(plan, date)
    week = { id: newWeekId(plan, month), title: `Week ${allWeeks(plan).length + 1}`, ...range, goal: '', days: [] }
    insertSorted(month.weeks, week, 'start')
  }
  let day = week.days.find((d) => d.date === date)
  if (!day) {
    day = { date, focus: '', tasks: [] }
    insertSorted(week.days, day, 'date')
  }
  return day
}

// Finds a task and the day it's on.
function findTask(plan, id) {
  for (const week of allWeeks(plan)) {
    for (const day of week.days) {
      const index = day.tasks.findIndex((t) => t.id === id)
      if (index !== -1) return { day, index, task: day.tasks[index] }
    }
  }
  throw new Error(`Task "${id}" not found`)
}

// A new id for my own tasks: custom-<date>-<4 random letters>, e.g. custom-2026-11-20-kqzt.
export function newCustomId(plan, date, random = Math.random) {
  const used = new Set(allTasks(plan).map((t) => t.id))
  for (;;) {
    const letters = Array.from({ length: 4 }, () => String.fromCharCode(97 + Math.floor(random() * 26))).join('')
    const id = `custom-${date}-${letters}`
    if (!used.has(id)) return id
  }
}

// Only the fields a task should have, with empty strings for the optional ones.
function cleanTask({ type, time, text, resources }) {
  return { type, time: (time ?? '').trim(), text: (text ?? '').trim(), resources: (resources ?? '').trim() }
}

// Adds one of my own tasks. Returns { plan, id }.
export function addTask(plan, { date, ...fields }, random) {
  const next = structuredClone(plan)
  const id = newCustomId(next, date, random)
  ensureDay(next, date).tasks.push({ id, ...cleanTask(fields) })
  return { plan: next, id }
}

// Changes a task's type, time, text and resources (not its id).
export function updateTask(plan, id, fields) {
  const next = structuredClone(plan)
  const { day, index, task } = findTask(next, id)
  day.tasks[index] = { id: task.id, ...cleanTask({ ...task, ...fields }) }
  return next
}

// Moves a task to another day. It keeps its id, so its tick stays with it.
export function moveTask(plan, id, date) {
  const next = structuredClone(plan)
  const { day, index, task } = findTask(next, id)
  if (day.date === date) return plan
  day.tasks.splice(index, 1)
  ensureDay(next, date).tasks.push(task)
  return next
}

export function deleteTask(plan, id) {
  const next = structuredClone(plan)
  const { day, index } = findTask(next, id)
  day.tasks.splice(index, 1)
  return next
}
