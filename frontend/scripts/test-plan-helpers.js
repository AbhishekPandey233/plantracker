// Self-check for the Today-view logic in planHelpers.js (streak, catch-up).
// Run with: npm run test:helpers
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bestStreak, calendarRows, computeStreak, dayStatus, daysBetween, flattenDays, getTodayContext, deleteMessage, filterHistory, firstUnfinishedDay, monthBounds, newlyCompleted, tasksByType, planSummary, shortDate, todayString } from '../src/utils/planHelpers.js'
import { validatePlan, validateProgress } from '../src/utils/validatePlan.js'
import { buildTimeline, routineWeekStats, formatClock, kathmanduParts, nowAndNext, parseTimeRange, routineTickIds, templateFor } from '../src/utils/timeHelpers.js'
import { tickUrl } from '../src/utils/api.js'
import { applyClaudeReply, buildMonth, claudePrompt, draftSummary, fillWithPattern, newDraft, syncDraft, wizardWeeks } from '../src/utils/monthWizard.js'

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

// --- Build Plan 3: day status, streaks, summary ---
{
  const ticks = new Set(['p1', 'q1', 'q2', 's1'])
  const has = (id) => ticks.has(id)
  const d = (date, ...ids) => ({ date, tasks: ids.map((id) => ({ id })) })
  const T = '2026-02-05'
  assert.equal(dayStatus(d('2026-02-01', 'q1', 'q2'), '2026-02-01', T, has), 'complete')
  assert.equal(dayStatus(d('2026-02-02', 'p1', 'p2'), '2026-02-02', T, has), 'partial')
  assert.equal(dayStatus(d('2026-02-03', 'm1'), '2026-02-03', T, has), 'missed')
  assert.equal(dayStatus(d(T, 'x1'), T, T, has), 'today')
  assert.equal(dayStatus(d(T, 'p1', 'x1'), T, T, has), 'partial', 'today with some ticked is partial')
  assert.equal(dayStatus(d('2026-02-09', 'x2'), '2026-02-09', T, has), 'upcoming')
  assert.equal(dayStatus(d('2026-02-09', 's1'), '2026-02-09', T, has), 'complete', 'a future day ticked early is complete')
  assert.equal(dayStatus(undefined, '2026-02-04', T, has), 'empty')
  assert.equal(dayStatus(d('2026-02-04'), '2026-02-04', T, has), 'empty', 'a day with no tasks is empty')

  // Streaks skip dates without tasks: 01 done, 02 (no tasks), 03 done, 04 done, 05 today unfinished.
  const streakDays = [d('2026-03-01', 'q1'), d('2026-03-02'), d('2026-03-03', 'q2'), d('2026-03-04', 's1'), d('2026-03-05', 'x1')]
  assert.equal(computeStreak(streakDays, '2026-03-05', has), 3, 'an empty day does not break the streak')
  assert.equal(bestStreak(streakDays, '2026-03-05', has), 3)
  const broken = [d('2026-03-01', 'q1'), d('2026-03-02', 'q2'), d('2026-03-03', 'x1'), d('2026-03-04', 's1')]
  assert.equal(computeStreak(broken, '2026-03-05', has), 1)
  assert.equal(bestStreak(broken, '2026-03-05', has), 2, 'best streak remembers the longer earlier run')

  assert.equal(daysBetween('2026-11-13', '2027-05-16'), 184)
  assert.equal(shortDate('2026-12-03'), 'Thu 3 Dec')

  const summaryPlan = {
    meta: { targetEnd: '2026-02-20', targetMonths: 6 },
    months: [{ id: 'm1', weeks: [{ id: 'w', days: [
      d('2026-02-01', 'q1', 'q2'), d('2026-02-02', 'p1', 'p2'), d('2026-02-03', 'm1'), d('2026-02-04'),
      d(T, 'x1'), d('2026-02-06', 'x2'),
    ] }] }],
  }
  assert.deepEqual(planSummary(summaryPlan, T, has), {
    plannedDays: 5, completedDays: 1, missedDays: 1, plannedLeft: 2, targetEnd: '2026-02-20', daysToTarget: 15,
    streak: 0, bestStreak: 1, monthsPlanned: 1, targetMonths: 6,
  })

  // Calendar helpers.
  assert.deepEqual(monthBounds('2026-12'), { start: '2026-12-01', end: '2026-12-31' })
  assert.deepEqual(monthBounds('2026-12', 1), { start: '2027-01-01', end: '2027-01-31' }, 'next month crosses the year')
  assert.deepEqual(monthBounds('2027-01', -1), { start: '2026-12-01', end: '2026-12-31' })
  assert.equal(monthBounds('2028-02').end, '2028-02-29', 'leap year')
  const rows = calendarRows('2026-12-01', '2026-12-31')
  assert.equal(rows.length, 5)
  assert.equal(rows[0][0], '2026-11-30', 'rows start on the Monday before the 1st')
  assert.equal(rows.at(-1)[6], '2027-01-03', 'rows end on a Sunday')

  const metaWarnings = (meta) => validatePlan({ months: [], meta }, { quiet: true })
  assert.deepEqual(metaWarnings({ start: '2026-11-18', targetEnd: '2027-05-16', targetMonths: 6 }), [])
  assert.equal(metaWarnings({ start: '2027-05-16', targetEnd: '2026-11-18' }).length, 1, 'start must be before targetEnd')
  assert.equal(metaWarnings({ targetEnd: '2027-02-30' }).length, 1, 'invalid date')
  const overlapping = { months: [{ id: 'a', start: '2026-01-01', end: '2026-01-31', weeks: [] }, { id: 'b', start: '2026-01-31', end: '2026-02-28', weeks: [] }] }
  assert.equal(validatePlan(overlapping, { quiet: true }).length, 1, 'overlapping months are reported')
}

// --- New month wizard ---
{
  const realPlan = JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8'))
  const frozen = JSON.stringify(realPlan)
  let draft = newDraft(realPlan, '2026-11-13')
  assert.equal(draft.start, '2026-12-21', 'starts the day after the last month')

  assert.deepEqual(wizardWeeks('2026-12-23', 2), [{ start: '2026-12-23', end: '2026-12-27' }, { start: '2026-12-28', end: '2027-01-03' }], 'a mid-week start makes a short first week')

  draft = syncDraft({ ...draft, title: 'Month 2: JavaScript', weekCount: 4 }, realPlan)
  assert.equal(draft.weeks.length, 4)
  assert.equal(draft.weeks[0].title, 'Week 6: ', 'week numbers continue from the plan')
  assert.equal(draft.weeks.at(-1).end, '2027-01-17')
  draft.weeks[0].days[0].focus = 'JS basics'
  const resynced = syncDraft({ ...draft, weekCount: 3 }, realPlan)
  assert.equal(resynced.weeks[0].days[0].focus, 'JS basics', 'typed text survives a re-sync')
  assert.equal(resynced.weeks.length, 3)

  draft = fillWithPattern(draft)
  const firstWeekTypes = draft.weeks[0].days.map((d) => d.tasks.map((t) => t.type).join('+'))
  assert.deepEqual(firstWeekTypes, ['learn+practise', 'learn+practise', 'learn+practise', 'learn+practise', 'learn+practise', 'project', 'review'])
  draft.weeks[0].days[0].tasks[0].text = 'Functions'
  draft.weeks[0].days[0].tasks.push({ type: 'learn', time: '', text: 'Arrow functions', resources: 'MDN' })
  assert.equal(draftSummary(draft), 'Month 2 · 4 weeks · 28 days · 2 tasks', 'empty-text tasks are not counted')

  assert.ok(buildMonth(realPlan, { ...draft, weeks: draft.weeks.map((w, i) => (i ? w : { ...w, title: ' ' })) }).problems, 'a week without a title is refused')
  let built = buildMonth(realPlan, draft)
  assert.ok(built.input, built.problems?.join('; '))
  const { weeks: inWeeks, tasks: inTasks, days: inDays } = built.input
  assert.deepEqual(inWeeks.map((w) => [w.monthTitle, w.start, w.end]).at(-1), ['Month 2: JavaScript', '2027-01-11', '2027-01-17'])
  assert.equal(inWeeks.length, 4)
  assert.deepEqual(inTasks.map((t) => [t.date, t.text]), [['2026-12-21', 'Functions'], ['2026-12-21', 'Arrow functions']], 'only tasks with text are sent')
  assert.deepEqual(inDays, [{ date: '2026-12-21', focus: 'JS basics' }], 'day focus is sent')
  assert.equal(JSON.stringify(realPlan), frozen, 'the original plan is not changed')

  const clash = buildMonth(realPlan, syncDraft({ ...draft, start: '2026-12-14' }, realPlan))
  assert.ok(clash.problems.some((p) => p.includes('overlap')), 'overlapping an existing month is refused')

  assert.ok(claudePrompt(draft).includes('Week 6: '), 'prompt lists the weeks')
  const reply = JSON.stringify({ weeks: [{ start: '2026-12-21', title: 'Week 6: JS', goal: 'Basics' }], tasks: [{ date: '2026-12-22', type: 'learn', time: '07:00-08:30', text: 'Arrays' }, { date: '2030-01-01', type: 'learn', text: 'x' }] })
  const applied = applyClaudeReply(draft, '```json ' + reply + ' ```')
  assert.equal(applied.count, 1)
  assert.equal(applied.problems.length, 1, 'a date outside the month is reported')
  assert.equal(applied.draft.weeks[0].title, 'Week 6: JS')
  assert.deepEqual(applied.draft.weeks[0].days[1].tasks.map((t) => t.text), ['Arrays'], "Claude's tasks replace that day's tasks")
  assert.equal(applyClaudeReply(draft, 'not json').problems.length, 1)
}

// --- Stats and celebrations ---
{
  const ticked = new Set(['a', 'b'])
  const before = (id) => ticked.has(id)
  const after = (id) => id === 'c' || ticked.has(id)
  assert.equal(newlyCompleted([['a', 'c']], before, after), true, 'ticking the last task completes the group')
  assert.equal(newlyCompleted([['a', 'b']], before, after), false, 'an already complete group does not count again')
  assert.equal(newlyCompleted([['a', 'd']], before, after), false)
  assert.equal(newlyCompleted([[]], before, after), false, 'empty groups never count')
  assert.equal(newlyCompleted([['a', 'c']], after, before), false, 'unticking never celebrates')

  const typed = { months: [{ weeks: [{ days: [{ date: '2026-01-01', tasks: [{ id: 'a', type: 'learn' }, { id: 'x', type: 'learn' }, { id: 'b', type: 'review' }] }] }] }] }
  assert.deepEqual(tasksByType(typed, before), { learn: { done: 1, total: 2 }, review: { done: 1, total: 1 } })

  const r = {
    weekday: [
      { id: 'wake', start: '06:30', label: 'Wake', kind: 'wake', tickable: true },
      { id: 'code', start: '07:00', end: '08:30', label: 'Code', kind: 'coding', tickable: true },
      { id: 'fr', start: '19:30', end: '20:15', label: 'French', kind: 'french', tickable: true },
      { id: 'meal', start: '12:00', end: '12:30', label: 'Lunch', kind: 'meal', tickable: false },
    ],
    saturday: [{ id: 'code', start: '09:00', end: '12:00', label: 'Code', kind: 'coding', tickable: true }],
  }
  const routineTicks = new Set(['routine-2026-11-23-wake', 'routine-2026-11-23-code', 'routine-2026-11-24-fr', 'routine-2026-11-28-code', 'routine-2026-11-30-wake'])
  assert.deepEqual(routineWeekStats(r, '2026-11-23', (id) => routineTicks.has(id)), {
    ticked: 4, total: 16, codingMinutes: 90 + 180, frenchMinutes: 45, wakeDays: 1,
  }, 'only this week counts (30 Nov is next week)')
}

// --- Talking to the backend ---
assert.equal(tickUrl('2026-11-18-learn'), '/api/ticks/tasks/2026-11-18-learn')
assert.equal(tickUrl('custom-2026-11-20-kqzt'), '/api/ticks/tasks/custom-2026-11-20-kqzt')
assert.equal(tickUrl('routine-2026-11-18-french-evening'), '/api/ticks/routine/2026-11-18/french-evening')
assert.equal(deleteMessage('This week', { tasks: 1, ticks: 2 }), 'This week has 1 task and 2 ticks. Deleting removes the tasks and their ticks for good.')

// --- History filters (Phase 7) ---
{
  const hist = [
    { date: '3', status: 'complete', hasJournal: true },
    { date: '2', status: 'partial', hasJournal: false },
    { date: '1', status: 'missed', hasJournal: true },
    { date: '0', status: 'empty', hasJournal: true },
  ]
  const dates = (f) => filterHistory(hist, f).map((d) => d.date).join(',')
  assert.equal(dates('all'), '3,2,1,0')
  assert.equal(dates('complete'), '3')
  assert.equal(dates('partial'), '2')
  assert.equal(dates('missed'), '1')
  assert.equal(dates('journal'), '3,1,0', 'has journal ignores the status')
}

// --- Reschedule default (Phase 8) ---
{
  const d = (date, ...ids) => ({ date, tasks: ids.map((id) => ({ id })) })
  const ticked = new Set(['a', 'b'])
  const has = (id) => ticked.has(id)
  assert.equal(firstUnfinishedDay([d('2026-01-03', 'c'), d('2026-01-01', 'a'), d('2026-01-02'), d('2026-01-04', 'b')], has), '2026-01-03', 'skips done and empty days')
  assert.equal(firstUnfinishedDay([d('2026-01-01', 'a')], has), null, 'everything done')
}

console.log('planHelpers OK: all checks passed')
