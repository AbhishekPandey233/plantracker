import { usePlanActions } from '../PlanContext'
import { formatDuration, formatMinutes, routineTickId } from '../utils/timeHelpers'
import TaskRow from './TaskRow'

// One colour per routine kind, for the dot next to each block.
const KIND_DOTS = {
  wake: 'bg-yellow-400',
  coding: 'bg-blue-500',
  french: 'bg-rose-400',
  work: 'bg-stone-500',
  meal: 'bg-lime-500',
  rest: 'bg-sky-400',
  fun: 'bg-violet-400',
  sleep: 'bg-indigo-500',
}

// One entry in the Today timeline: a routine block (with today's matching tasks
// inside it) or one of my own tasks that has a time.
// "state" is 'now', 'next', 'past' or 'later'; "minutesUntil" is set for 'next'.
function TimelineItem({ item, date, state, minutesUntil }) {
  const { isDone, toggle } = usePlanActions()
  const { block, task } = item
  const tickId = block?.tickable ? routineTickId(date, block.id) : null
  const done = tickId ? isDone(tickId) : false

  return (
    <li className="relative flex gap-3">
      {/* Time column */}
      <div className="w-14 shrink-0 pt-3 text-right text-xs tabular-nums text-slate-400">
        <div className={state === 'now' ? 'font-semibold text-teal-600' : ''}>{formatMinutes(item.start)}</div>
        {item.end != null && <div>{formatMinutes(item.end)}</div>}
      </div>

      <div
        className={`flex-1 rounded-xl px-4 py-3 mb-2 transition-[box-shadow,opacity] duration-300 ${
          state === 'now' ? 'bg-white shadow-md ring-2 ring-teal-500' : 'bg-white/80 shadow-sm'
        } ${state === 'past' ? 'opacity-60' : ''}`}
      >
        {block ? (
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${KIND_DOTS[block.kind] ?? 'bg-slate-400'}`} />
            {tickId ? (
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(tickId)}
                  className="h-4 w-4 accent-teal-600 cursor-pointer transition-transform duration-150 active:scale-75"
                />
                <span className={`font-medium text-slate-700 ${done ? 'line-through opacity-60' : ''}`}>{block.label}</span>
              </label>
            ) : (
              <span className="font-medium text-slate-700 flex-1">{block.label}</span>
            )}
            <StateLabel state={state} minutesUntil={minutesUntil} />
          </div>
        ) : (
          <div className="flex justify-end -mb-2">
            <StateLabel state={state} minutesUntil={minutesUntil} />
          </div>
        )}

        {/* Tasks inside a block, or the item's own task */}
        {(block ? item.tasks : [task]).length > 0 && (
          <div className={block ? 'mt-2' : ''}>
            {(block ? item.tasks : [task]).map((t) => (
              <TaskRow key={t.id} task={t} date={date} />
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

// The small "Now" badge or "starts in 20 min" text.
function StateLabel({ state, minutesUntil }) {
  if (state === 'now') {
    return <span className="animate-pop text-[11px] font-bold uppercase tracking-wide bg-teal-600 text-white rounded-full px-2 py-0.5">Now</span>
  }
  if (state === 'next') {
    return <span className="text-xs text-teal-600 font-medium">starts in {formatDuration(minutesUntil)}</span>
  }
  return null
}

export default TimelineItem
