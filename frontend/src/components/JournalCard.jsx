import { useEffect, useState } from 'react'
import { api } from '../utils/api'

const MOODS = ['😞', '😕', '😐', '🙂', '😄'] // mood 1-5
const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500'
const EMPTY = { learned: '', struggled: '', notes: '', mood: null }

// The journal for one day: what I learned, what I struggled with, notes and a mood.
// Used by the end-of-day card on Today (after 21:30) and by the day detail for past days.
// Everything is shown as plain text: React escapes it, so typed HTML is never run.
function JournalCard({ date, title }) {
  // null while loading; then the saved entry (or empty fields)
  const [entry, setEntry] = useState(null)
  const [saved, setSaved] = useState(false) // true once this entry exists on the server
  const [state, setState] = useState('idle') // 'idle', 'dirty' (unsaved edits), 'saving', 'saved' or an error message

  // Load the entry when the card appears (the parent gives each date its own card with key={date}).
  useEffect(() => {
    api(`/api/journal/${date}`)
      .then((data) => {
        setEntry({ learned: data.learned, struggled: data.struggled, notes: data.notes, mood: data.mood })
        setSaved(data.exists)
      })
      .catch((err) => {
        setEntry(EMPTY)
        setState(err.message)
      })
  }, [date])

  const change = (key, value) => {
    setEntry({ ...entry, [key]: value })
    setState('dirty') // the check mark goes away until it's saved again
  }

  async function save(e) {
    e.preventDefault()
    setState('saving')
    try {
      const data = await api(`/api/journal/${date}`, { method: 'PUT', body: entry })
      setSaved(data.exists)
      setState('saved')
    } catch (err) {
      setState(err.message)
    }
  }

  if (!entry) return null
  const error = !['idle', 'dirty', 'saving', 'saved'].includes(state) && state

  return (
    <form onSubmit={save} className="animate-fade-up bg-white rounded-xl shadow-sm p-4 mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {saved && (state === 'idle' || state === 'saved') && <span className="animate-pop text-sm font-semibold text-green-700">Saved ✓</span>}
      </div>
      <label className="block">
        <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">What did I learn?</span>
        <textarea rows={3} maxLength={5000} value={entry.learned} onChange={(e) => change('learned', e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">What did I struggle with?</span>
        <textarea rows={2} maxLength={5000} value={entry.struggled} onChange={(e) => change('struggled', e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Notes</span>
        <textarea rows={2} maxLength={5000} value={entry.notes} onChange={(e) => change('notes', e.target.value)} className={field} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Mood">
          <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Mood</span>
          {MOODS.map((face, i) => (
            <button
              key={face}
              type="button"
              aria-label={`Mood ${i + 1} of 5`}
              aria-pressed={entry.mood === i + 1}
              // Clicking the chosen mood again clears it.
              onClick={() => change('mood', entry.mood === i + 1 ? null : i + 1)}
              className={`h-9 w-9 rounded-full text-lg transition active:scale-90 ${entry.mood === i + 1 ? 'bg-teal-600/20 ring-2 ring-teal-500' : 'hover:bg-slate-50'}`}
            >
              {face}
            </button>
          ))}
        </div>
        <button type="submit" disabled={state === 'saving'} className="text-sm font-semibold text-white bg-teal-600 rounded-full px-4 py-2 active:scale-95 transition disabled:opacity-50">
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="rounded-lg bg-amber-100 text-amber-800 text-sm px-3 py-2 whitespace-pre-line">{error}</p>}
    </form>
  )
}

export default JournalCard
