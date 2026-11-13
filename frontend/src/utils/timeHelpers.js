// Time helpers for the Today timeline. Everything uses Kathmandu time,
// whatever the laptop's own time zone is set to.

export const TIME_ZONE = 'Asia/Kathmandu'

// The current moment. For testing you can pretend it's another time by opening
//   http://localhost:5173/?now=2026-11-18T07:30   (a Kathmandu date and time)
export function currentMoment() {
  const fake = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('now')
  if (fake) {
    const moment = new Date(`${fake}:00+05:45`) // +05:45 is Kathmandu's offset from UTC
    if (!isNaN(moment)) return moment
  }
  return new Date()
}

// Kathmandu date and time of a moment: { date: 'YYYY-MM-DD', minutes: minutes since midnight }.
export function kathmanduParts(moment) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(moment)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

// "07:30" -> 450 (minutes since midnight).
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// "7:00-8:30" or "19:30 - 20:15" -> { start: 420, end: 510 }. Anything else ("Work hour") -> null.
export function parseTimeRange(text) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(text ?? '')
  if (!m) return null
  const start = Number(m[1]) * 60 + Number(m[2])
  const end = Number(m[3]) * 60 + Number(m[4])
  return start < end && end <= 24 * 60 && Number(m[2]) < 60 && Number(m[4]) < 60 ? { start, end } : null
}

// 450 -> "07:30"
export function formatMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// Which routine template a date uses: 'weekday', 'saturday' or 'sunday'.
export function templateFor(date) {
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay() // 0 = Sunday, 6 = Saturday
  return weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : 'weekday'
}

// "Fri 20 Nov · 7:42 am"
export function formatClock(moment) {
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })
    .format(moment)
    .replace(',', '')
  const time = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' })
    .format(moment)
    .toLowerCase()
  return `${date} · ${time}`
}

export function greeting(minutes) {
  if (minutes < 12 * 60) return 'Good morning'
  if (minutes < 17 * 60) return 'Good afternoon'
  return 'Good evening'
}

// 20 -> "20 min", 80 -> "1 h 20 min", 120 -> "2 h"
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

// Given timeline items ({ key, start, end }, in minutes, sorted by start), finds the
// items happening now (usually one; more if my own task overlaps a block) and the next
// one to start. Items without an end (wake up, sleep) are single moments, so they can
// be "next" but never "now".
export function nowAndNext(items, minutes) {
  const nowKeys = items.filter((item) => item.end != null && item.start <= minutes && minutes < item.end).map((item) => item.key)
  const next = items.find((item) => item.start > minutes)
  return {
    nowKeys,
    nextKey: next?.key ?? null,
    minutesUntilNext: next ? next.start - minutes : null,
  }
}

export const isCustomTask = (task) => task.id.startsWith('custom-')

// Tick id for a routine block on a date, e.g. "routine-2026-11-18-french-evening".
export const routineTickId = (date, blockId) => `routine-${date}-${blockId}`

// The routine blocks for a date, from the right template.
export function routineFor(routine, date) {
  return routine?.[templateFor(date)] ?? []
}

// Tick ids of the tickable routine blocks on a date.
export function routineTickIds(routine, date) {
  return routineFor(routine, date)
    .filter((block) => block.tickable)
    .map((block) => routineTickId(date, block.id))
}

// Builds a day's timeline: routine blocks plus tasks, in time order.
// Where each of the day's tasks goes:
//   1. my own task with a time range ("19:30-20:15") -> its own item at that time
//   2. a block with a matching taskType exists       -> inside that block
//   3. any other task with a time range              -> its own item at that time
//   4. everything else                               -> "Anytime today"
export function buildTimeline(routine, date, tasks = []) {
  const placed = new Set()
  const timed = (task) => parseTimeRange(task.time)

  const items = routineFor(routine, date).map((block) => {
    const inside = block.taskType
      ? tasks.filter((t) => t.type === block.taskType && !placed.has(t.id) && !(isCustomTask(t) && timed(t)))
      : []
    inside.forEach((t) => placed.add(t.id))
    return {
      key: `block-${block.id}`,
      block,
      tasks: inside,
      start: toMinutes(block.start),
      end: block.end ? toMinutes(block.end) : null,
    }
  })

  const anytime = []
  for (const task of tasks) {
    if (placed.has(task.id)) continue
    const range = timed(task)
    if (range) items.push({ key: `task-${task.id}`, task, ...range })
    else anytime.push(task)
  }

  // sort keeps equal starts in their original order (blocks first)
  items.sort((a, b) => a.start - b.start)
  return { items, anytime }
}
