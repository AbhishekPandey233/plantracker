import { usePlanActions } from '../PlanContext'
import { allTasks, mondayOf, planSummary, tasksByType } from '../utils/planHelpers'
import { formatDuration, routineWeekStats } from '../utils/timeHelpers'
import { TASK_TYPES } from '../utils/validatePlan'
import ProgressBar from './ProgressBar'

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-slate-800 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

// The Stats section at the bottom of the Months view.
function StatsSection({ today }) {
  const { plan, isDone } = usePlanActions()
  const tasks = allTasks(plan)
  const done = tasks.filter((t) => isDone(t.id)).length
  const byType = tasksByType(plan, isDone)
  const { streak, bestStreak } = planSummary(plan, today, isDone)
  const routine = routineWeekStats(plan.routine, mondayOf(today), isDone)

  return (
    <section className="animate-fade-up bg-white rounded-xl shadow-sm p-5 mt-5">
      <h2 className="font-semibold text-slate-800 text-lg mb-3">Stats</h2>

      <ProgressBar label="Whole plan (tasks planned so far)" done={done} total={tasks.length} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        <Tile label="Streak" value={streak} sub={`best ever ${bestStreak}`} />
        <Tile label="Routine this week" value={`${routine.ticked}/${routine.total}`} sub="blocks ticked" />
        <Tile label="Wake-up on time" value={`${routine.wakeDays}/7`} sub="days this week" />
        <Tile label="Coding this week" value={formatDuration(routine.codingMinutes)} sub="from ticked routine blocks" />
        <Tile label="French this week" value={formatDuration(routine.frenchMinutes)} sub="from ticked routine blocks" />
      </div>

      <h3 className="text-sm font-semibold text-slate-700 mt-5 mb-2">Tasks done per type</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5">
        {TASK_TYPES.map((type) => (
          <ProgressBar key={type} label={type} done={byType[type]?.done ?? 0} total={byType[type]?.total ?? 0} />
        ))}
      </div>
    </section>
  )
}

export default StatsSection
