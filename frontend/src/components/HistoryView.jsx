import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { HISTORY_FILTERS, filterHistory, shortDate } from '../utils/planHelpers'
import { StatusDot } from './CalendarGrid'

const chip = 'text-xs font-medium rounded-full px-3 py-1 transition active:scale-95'

// Look back: past days newest first, with filters and a search through the journal.
// "today" and "onOpenDay(date)" come from Tracker.
function HistoryView({ today, onOpenDay }) {
  const [days, setDays] = useState(null) // null while loading
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Load again when the search changes, 300 ms after the last key press
  // (so typing "closures" sends one request, not eight).
  useEffect(() => {
    const params = new URLSearchParams({ to: today, today })
    if (search.trim()) params.set('q', search.trim())
    const timer = setTimeout(() => {
      api(`/api/history?${params}`)
        .then((data) => {
          setDays(data)
          setError(null)
        })
        .catch((err) => setError(err.message))
    }, search ? 300 : 0)
    // Cleanup: a newer key press cancels the waiting request.
    return () => clearTimeout(timer)
  }, [search, today])

  const shown = days ? filterHistory(days, filter) : []

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold text-slate-800 text-center mb-5">History</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        maxLength={100}
        placeholder="Search my journal…"
        aria-label="Search the journal"
        className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="flex flex-wrap gap-2 mt-3 mb-4" role="group" aria-label="Filter days">
        {Object.entries(HISTORY_FILTERS).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`${chip} ${filter === key ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-amber-100 text-amber-800 text-sm px-4 py-3 whitespace-pre-line">{error}</p>}
      {days && shown.length === 0 && (
        <p className="text-center text-slate-500 py-10">{search.trim() ? 'No journal entries match that search.' : 'No days here yet.'}</p>
      )}

      <ol className="space-y-2">
        {shown.map((d, i) => (
          <li key={d.date} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
            <button
              onClick={() => onOpenDay(d.date)}
              className="w-full text-left bg-white rounded-xl shadow-sm px-4 py-3 hover:shadow-md transition-shadow active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <StatusDot status={d.status} large />
                <span className="font-semibold text-slate-800">{shortDate(d.date)}</span>
                {d.focus && <span className="text-sm text-slate-500 truncate">{d.focus}</span>}
                <span className="ml-auto flex items-center gap-2 shrink-0">
                  {d.hasJournal && <span title="Has a journal entry" className="text-xs font-semibold uppercase text-teal-600">journal</span>}
                  {d.total > 0 && <span className="text-sm text-slate-600 tabular-nums">{d.done}/{d.total} done</span>}
                </span>
              </div>
              {d.learned && <p className="text-sm text-slate-600 mt-1 truncate">Learned: {d.learned}</p>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default HistoryView
