// Self-check for the Today-view logic in planHelpers.js (streak, catch-up).
// Run with: npm run test:helpers
import assert from 'node:assert/strict'
import { computeStreak, flattenDays, getTodayContext, mergeTicks, todayString } from '../src/utils/planHelpers.js'
import { validatePlan, validateProgress } from '../src/utils/validatePlan.js'
import { buildTimeline, formatClock, kathmanduParts, nowAndNext, parseTimeRange, routineTickIds, templateFor } from '../src/utils/timeHelpers.js'
import { addTask, deleteTask, ensureDay, moveTask, updateTask } from '../src/utils/planEdit.js'
import { ImportError, importIntoPlan } from '../src/utils/planImport.js'

const plan = {
  months: [{
    id: 'm1',
    weeks: [{
      id: 'w1',
      days: [
        { date: '2026-01-01', tasks: [{ id: 'a' }, { id: 'b' }] },
        { date: '2026-01-02', tasks: [{ id: 'c' }] },
        { date: '2026-01-03', tasks: [{ id: 'd' }] },
      ],
    }],
  }],
}
const days = flattenDays(plan)
const done = new Set()
const isDone = (id) => done.has(id)

// Today is before the plan starts -> falls forward to the next day that has tasks.
let ctx = getTodayContext(days, '2025-12-31', isDone)
assert.equal(ctx.targetDay.date, '2026-01-01', 'falls forward to the next day with tasks')
assert.equal(ctx.catchUpTasks.length, 0, 'no catch-up before the plan starts')

// Tick day 1 fully.
done.add('a')
done.add('b')
ctx = getTodayContext(days, '2026-01-02', isDone)
assert.equal(ctx.catchUpTasks.length, 0, 'fully ticked earlier day has nothing to catch up')
assert.equal(computeStreak(days, '2026-01-02', isDone), 1, 'yesterday fully ticked -> 1-day streak')

// Day 2 still unticked -> shows as catch-up, and breaks the streak.
ctx = getTodayContext(days, '2026-01-03', isDone)
assert.equal(ctx.catchUpTasks.length, 1, 'unticked task from 01-02 shows up as catch-up')
assert.equal(computeStreak(days, '2026-01-03', isDone), 0, 'yesterday not fully ticked -> streak 0')

// Tick yesterday too: 01-01 and 01-02 are now consecutive fully-ticked days.
done.add('c')
assert.equal(computeStreak(days, '2026-01-03', isDone), 2, '01-01 and 01-02 both ticked -> 2')
// Tick today too ("today counts once complete") -> extends the run to 3.
done.add('d')
assert.equal(computeStreak(days, '2026-01-03', isDone), 3, 'today ticked too -> counts immediately')

// todayString must give the Kathmandu date. Freeze the clock at 1:00 am on 20 Nov in
// Kathmandu (still 19 Nov in UTC), and set the computer's zone to UTC to prove the
// laptop's own setting doesn't matter.
process.env.TZ = 'UTC'
const RealDate = Date
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : ['2026-11-19T19:15:00Z'])) }
}
assert.equal(todayString(), '2026-11-20', 'today is the Kathmandu date, not the UTC date')
globalThis.Date = RealDate

// mergeTicks: a tick on either side stays ticked; an untick on one side doesn't erase a tick.
assert.deepEqual(
  mergeTicks({ a: true, b: false, c: false }, { b: true, c: false, d: true }),
  { a: true, b: true, c: false, d: true },
  'merge keeps every tick from both sides',
)

// validateProgress: only { "id": true/false } is allowed.
assert.deepEqual(validateProgress({ a: true, b: false }), [], 'valid progress has no problems')
assert.equal(validateProgress({ a: 'yes' }).length, 1, 'non-boolean tick is rejected')
assert.equal(validateProgress([true]).length, 1, 'a list is not progress')
assert.equal(validateProgress(null).length, 1, 'null is not progress')

// validatePlan: a body that isn't shaped like a plan is rejected instead of crashing.
const realWarn = console.warn
console.warn = () => {} // keep the expected warnings out of the test output
assert.equal(validatePlan({ nope: 1 }).length, 1, 'plan without months is rejected')
assert.equal(validatePlan('hello').length, 1, 'a string is not a plan')
console.warn = realWarn

// ---------- Build Plan 2: routine checks (Phase 3) ----------
const block = (id, start, end, extra = {}) => ({ id, start, ...(end && { end }), label: id, kind: 'rest', tickable: true, ...extra })
const withRoutine = (routine) => ({ months: [], routine })
const q = { quiet: true }
assert.deepEqual(validatePlan(withRoutine({ weekday: [block('a', '07:00', '08:30'), block('b', '08:30', '09:00')] }), q), [], 'touching blocks are fine')
assert.equal(validatePlan(withRoutine({ weekday: [block('a', '07:00', '08:30'), block('b', '08:00', '09:00')] }), q).length, 1, 'overlapping blocks are caught')
assert.deepEqual(validatePlan(withRoutine({ saturday: [block('wake', '07:30'), block('breakfast', '07:30', '09:00')] }), q), [], 'a moment at the start of a block is fine')
assert.equal(validatePlan(withRoutine({ weekday: [block('a', '7:00', '08:30')] }), q).length, 1, 'times must be HH:MM')
assert.equal(validatePlan(withRoutine({ weekday: [block('a', '09:00', '08:00')] }), q).length, 1, 'end must be after start')
assert.equal(validatePlan(withRoutine({ weekday: [block('a', '07:00'), block('a', '09:00')] }), q).length, 1, 'duplicate block ids are caught')
assert.equal(validatePlan(withRoutine({ weekday: [block('a', '07:00', null, { kind: 'nap' })] }), q).length, 1, 'unknown kind is caught')
assert.equal(validatePlan(withRoutine({ monday: [] }), q).length, 1, 'unknown template name is caught')

// ---------- Kathmandu time and the timeline (Phase 4) ----------
const at = (kathmanduTime) => new Date(`${kathmanduTime}:00+05:45`)
assert.deepEqual(kathmanduParts(at('2026-11-20T07:42')), { date: '2026-11-20', minutes: 7 * 60 + 42 }, 'Kathmandu date and minutes')
assert.equal(formatClock(at('2026-11-20T07:42')), 'Fri 20 Nov · 7:42 am', 'clock format')
assert.equal(templateFor('2026-11-20'), 'weekday', 'Friday uses the weekday template')
assert.equal(templateFor('2026-11-21'), 'saturday')
assert.equal(templateFor('2026-11-22'), 'sunday')
assert.deepEqual(parseTimeRange('7:00-8:30'), { start: 420, end: 510 }, 'time range with single-digit hour')
assert.equal(parseTimeRange('Work hour'), null, 'free text is not a time range')

const routine = {
  weekday: [
    { id: 'wake', start: '06:30', label: 'Wake', kind: 'wake', tickable: true },
    { id: 'coding', start: '07:00', end: '08:30', label: 'Coding', kind: 'coding', taskType: 'learn', tickable: true },
    { id: 'breakfast', start: '08:30', end: '09:10', label: 'Breakfast', kind: 'meal', tickable: false },
    { id: 'french', start: '19:30', end: '20:15', label: 'French', kind: 'french', tickable: true },
  ],
}
const dayTasks = [
  { id: '2026-11-20-learn', type: 'learn', time: '7:00-8:30', text: 'Learn' },
  { id: '2026-11-20-practise', type: 'practise', time: 'Work hour', text: 'Practise' },
  { id: 'custom-2026-11-20-abcd', type: 'french', time: '20:30-21:00', text: 'Mine, timed' },
]
const timeline = buildTimeline(routine, '2026-11-20', dayTasks)
assert.deepEqual(timeline.items.find((i) => i.key === 'block-coding').tasks.map((t) => t.id), ['2026-11-20-learn'], 'learn task sits inside the coding block')
assert.ok(timeline.items.some((i) => i.key === 'task-custom-2026-11-20-abcd'), 'my timed task gets its own timeline item')
assert.deepEqual(timeline.anytime.map((t) => t.id), ['2026-11-20-practise'], 'task with no block and no time goes to Anytime')
assert.deepEqual(timeline.items.map((i) => i.start), [...timeline.items.map((i) => i.start)].sort((a, b) => a - b), 'items are in time order')

let status = nowAndNext(timeline.items, 7 * 60 + 30) // 7:30 am
assert.deepEqual(status.nowKeys, ['block-coding'], 'at 7:30 the coding block is now')
assert.equal(status.nextKey, 'block-breakfast', 'breakfast is next')
assert.equal(status.minutesUntilNext, 60)
status = nowAndNext(timeline.items, 12 * 60) // noon: in the gap between breakfast and French
assert.deepEqual(status.nowKeys, [], 'nothing is happening in a gap')
assert.equal(status.nextKey, 'block-french', 'French is next after the gap')
assert.equal(status.minutesUntilNext, 7 * 60 + 30)
status = nowAndNext(timeline.items, 6 * 60 + 30) // exactly wake-up time
assert.deepEqual(status.nowKeys, [], 'a one-moment block is never "now"')
assert.deepEqual(nowAndNext(timeline.items, 20 * 60 + 40).nowKeys, ['task-custom-2026-11-20-abcd'], 'my timed task can be now')
assert.deepEqual(routineTickIds(routine, '2026-11-20'), ['routine-2026-11-20-wake', 'routine-2026-11-20-coding', 'routine-2026-11-20-french'], 'routine tick ids for tickable blocks')

// ---------- Add, edit, move, delete (Phase 5) ----------
const basePlan = {
  months: [{
    id: 'm1', title: 'Month 1', start: '2026-11-18', end: '2026-12-20',
    weeks: [{ id: 'm1-w1', title: 'Week 1', start: '2026-11-18', end: '2026-11-22', goal: '', days: [
      { date: '2026-11-18', focus: 'Setup', tasks: [{ id: '2026-11-18-learn', type: 'learn', time: '7:00-8:30', text: 'Install', resources: '' }] },
    ] }],
  }],
}
const frozenBase = JSON.stringify(basePlan)
const fixedRandom = () => 0 // always "a", so the id is custom-<date>-aaaa
const added = addTask(basePlan, { date: '2026-11-19', type: 'french', time: '19:30-20:15', text: 'Duolingo', resources: '' }, fixedRandom)
assert.equal(added.id, 'custom-2026-11-19-aaaa', 'custom id format')
assert.equal(JSON.stringify(basePlan), frozenBase, 'the original plan is not changed')
assert.deepEqual(validatePlan(added.plan, q), [], 'plan with my task is valid')
let plan2 = updateTask(added.plan, added.id, { text: 'Duolingo 20 min' })
assert.equal(plan2.months[0].weeks[0].days[1].tasks[0].text, 'Duolingo 20 min', 'edit changes the text')
plan2 = moveTask(plan2, '2026-11-18-learn', '2026-11-20')
const movedDay = plan2.months[0].weeks[0].days.find((d) => d.date === '2026-11-20')
assert.equal(movedDay.tasks[0].id, '2026-11-18-learn', 'a moved task keeps its original id')
plan2 = moveTask(plan2, added.id, '2026-12-25') // no week exists for this date yet
assert.deepEqual(validatePlan(plan2, q), [], 'moving to a date with no week creates a valid week')
const newWeek = plan2.months.flatMap((m) => m.weeks).find((w) => w.start <= '2026-12-25' && '2026-12-25' <= w.end)
assert.deepEqual([newWeek.start, newWeek.end], ['2026-12-21', '2026-12-27'], 'the new week runs Monday to Sunday')
plan2 = deleteTask(plan2, added.id)
assert.ok(!JSON.stringify(plan2).includes(added.id), 'delete removes the task')
// Week 1 starts on a Wednesday, so a new week for the Tuesday before must stop before it.
const early = structuredClone(basePlan)
ensureDay(early, '2026-11-17')
assert.deepEqual(validatePlan(early, q), [], 'a new week next to an existing one does not overlap it')
const earlyWeek = early.months.flatMap((m) => m.weeks).find((w) => w.days.some((d) => d.date === '2026-11-17'))
assert.deepEqual([earlyWeek.start, earlyWeek.end], ['2026-11-16', '2026-11-17'], 'the new week stops before week 1 starts')

// ---------- Import from Claude (Phase 6) ----------
const imported = importIntoPlan(basePlan, {
  weeks: [{ monthTitle: 'Month 2: JavaScript', title: 'Week 6: JS basics', start: '2026-12-21', end: '2026-12-27', goal: 'Functions' }],
  tasks: [
    { date: '2026-12-21', type: 'learn', time: '07:00-08:30', text: 'Functions', resources: 'MDN' },
    { date: '2026-12-21', type: 'learn', text: 'Arrow functions' },
    { date: '2026-11-18', type: 'learn', text: 'Extra on day 1' },
  ],
})
assert.deepEqual(imported.summary.tasks.map((t) => t.id), ['2026-11-18-learn-2', '2026-12-21-learn', '2026-12-21-learn-2'], 'ids are <date>-<type>, then -2')
assert.deepEqual(imported.summary.newWeeks, ['Week 6: JS basics'])
assert.equal(imported.plan.months.find((m) => m.title === 'Month 2: JavaScript').weeks[0].days[0].tasks.length, 2, 'tasks land in the imported week')
assert.equal(JSON.stringify(basePlan), frozenBase, 'import does not change the original plan')
assert.throws(() => importIntoPlan(basePlan, { tasks: [{ id: '2026-11-18-learn', date: '2026-11-19', type: 'learn', text: 'x' }] }), ImportError, 'an existing id is rejected')
assert.throws(() => importIntoPlan(basePlan, { tasks: [{ date: '2026-11-19', type: 'learn', text: 'ok' }, { date: 'tomorrow', type: 'learn', text: 'bad' }] }), ImportError, 'one bad task rejects the whole import')
assert.throws(() => importIntoPlan(basePlan, { routine: { weekday: [{ start: '07:00', end: '08:00', label: 'A', kind: 'rest' }, { start: '07:30', end: '09:00', label: 'B', kind: 'rest' }] } }), ImportError, 'overlapping routine is rejected')
const withOldRoutine = { ...basePlan, routine: { weekday: [{ id: 'french-evening', start: '19:30', end: '20:15', label: 'French focused study', kind: 'french', tickable: true }] } }
const reRoutine = importIntoPlan(withOldRoutine, { routine: { weekday: [{ start: '19:00', end: '20:00', label: 'French focused study', kind: 'french', tickable: true }] } })
assert.equal(reRoutine.plan.routine.weekday[0].id, 'french-evening', 'a block with the same label keeps its id')

console.log('planHelpers OK: all checks passed')


