import { useEffect, useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { api } from '../utils/api'
import { addDays, daysBetween, firstUnfinishedDay, flattenDays, shortDate } from '../utils/planHelpers'
import Modal from './Modal'

const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500'
const primary = 'text-sm font-semibold text-white bg-teal-600 rounded-full px-4 py-2 active:scale-95 transition disabled:opacity-40'
const secondary = 'text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-full px-4 py-2 transition'
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// "Reschedule": move every unfinished day from a date onwards by the same number of
// days (completed days stay). Preview first (a dry run on the server), then Shift.
// Also offers "Undo last shift".
function RescheduleDialog({ today, onClose }) {
  const { plan, isDone, editPlan } = usePlanActions()
  const startFrom = firstUnfinishedDay(flattenDays(plan), isDone) ?? today
  const [fromDate, setFromDate] = useState(startFrom)
  const [newStart, setNewStart] = useState(addDays(startFrom, 7))
  const [preview, setPreview] = useState(null) // the server's dry-run answer
  const [last, setLast] = useState(null) // the most recent shift, for Undo
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/reschedule/last').then(setLast).catch(() => {})
  }, [])

  const shiftDays = fromDate && newStart ? daysBetween(fromDate, newStart) : 0
  const body = { fromDate, newStart }

  // Runs an action, showing the server's message if it refuses.
  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const showPreview = () => run(async () => setPreview(await api('/api/reschedule?dry_run=true', { method: 'POST', body })))
  const doShift = () =>
    run(async () => {
      await editPlan('/api/reschedule', { method: 'POST', body })
      onClose()
    })
  const undo = () =>
    run(async () => {
      await editPlan('/api/reschedule/undo', { method: 'POST' })
      onClose()
    })

  return (
    <Modal title="Reschedule" onClose={onClose} wide>
      {!preview ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Fell behind? Move every unfinished day from a date onwards later by the same number of days.
            Completed days stay where they are; ticks stay with their tasks.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex-1 min-w-40">
              <span className="block text-sm font-medium text-slate-600 mb-1">From date (usually the first unfinished day)</span>
              <input type="date" className={input} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="flex-1 min-w-40">
              <span className="block text-sm font-medium text-slate-600 mb-1">New start date</span>
              <input type="date" className={input} value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </label>
          </div>
          {shiftDays > 0 && (
            <p className={`text-sm rounded-lg px-3 py-2 ${shiftDays % 7 === 0 ? 'bg-slate-50 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>
              Shifts by {plural(shiftDays, 'day')}
              {shiftDays % 7 === 0
                ? ` (${plural(shiftDays / 7, 'week')}): Saturdays stay project days and Sundays stay review days.`
                : '. Not a whole number of weeks: some tasks will land on unusual weekdays (the preview lists them). Whole weeks are recommended.'}
            </p>
          )}
          {last && !last.undone && (
            <p className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
              Last shift: {plural(last.days, 'day')} from {shortDate(last.fromDate)}.
              <button className="font-medium text-teal-600 hover:underline disabled:opacity-40" disabled={busy} onClick={undo}>
                Undo last shift
              </button>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button className={secondary} onClick={onClose}>Cancel</button>
            <button className={primary} disabled={busy || shiftDays <= 0} onClick={showPreview}>
              {busy ? 'Checking…' : 'Preview'}
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-up space-y-3">
          <p className="font-medium text-slate-800">
            Moves {plural(preview.moved.length, 'day')} by {plural(preview.days, 'day')}
            {preview.kept.length > 0 && `; ${plural(preview.kept.length, 'completed day')} stay${preview.kept.length === 1 ? 's' : ''}`}.
          </p>
          {preview.unusual.length > 0 && (
            <div className="rounded-lg bg-amber-100 text-amber-800 text-sm px-3 py-2">
              <p className="font-semibold">On unusual weekdays after the move:</p>
              <ul className="list-disc list-inside">
                {preview.unusual.map((u) => (
                  <li key={`${u.date}-${u.text}`}>{u.type} on {u.weekday} {shortDate(u.date)}: {u.text}</li>
                ))}
              </ul>
            </div>
          )}
          <ol className="max-h-72 overflow-y-auto text-sm text-slate-700 divide-y divide-slate-200 bg-slate-50 rounded-lg px-3">
            {preview.moved.map((m) => (
              <li key={m.date} className="py-1.5 flex gap-3">
                <span className="tabular-nums text-slate-500">{shortDate(m.date)} → <span className="font-semibold text-slate-800">{shortDate(m.newDate)}</span></span>
                <span className="truncate">{m.focus}</span>
                <span className="ml-auto text-slate-500 shrink-0">{plural(m.tasks, 'task')}</span>
              </li>
            ))}
          </ol>
          <div className="flex justify-end gap-2">
            <button className={secondary} onClick={() => setPreview(null)}>Back</button>
            <button className={primary} disabled={busy} onClick={doShift}>{busy ? 'Shifting…' : 'Shift'}</button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-amber-100 text-amber-800 text-sm px-3 py-2 whitespace-pre-line">{error}</p>}
    </Modal>
  )
}

export default RescheduleDialog
