// Self-check for the Today-view logic in planHelpers.js (streak, catch-up).
// Run with: npm run test:helpers
import assert from 'node:assert/strict'
import { computeStreak, flattenDays, getTodayContext } from '../src/utils/planHelpers.js'

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

console.log('planHelpers OK: 6 checks passed')
