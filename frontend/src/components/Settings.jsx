import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { api } from '../utils/api'

const button = 'text-sm font-semibold rounded-full px-4 py-2 active:scale-95 transition disabled:opacity-50'

// Settings: export everything as a JSON file, and import such a file again.
// The full safety net is the daily pg_dump (backend\scripts\backup.ps1); this is the readable copy.
function Settings({ today }) {
  const { editPlan } = usePlanActions()
  const [backup, setBackup] = useState(null) // the chosen file's parsed JSON, waiting for "Restore"
  const [status, setStatus] = useState(null) // a message after export/import
  const [busy, setBusy] = useState(false)

  // Download: ask the backend for everything, wrap it in a Blob (a file in memory)
  // and click a temporary link to it, which makes the browser save it.
  async function exportAll() {
    setBusy(true)
    try {
      const data = await api('/api/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `plan-tracker-${today}.json`
      link.click()
      URL.revokeObjectURL(url)
      setStatus('Exported. Check your Downloads folder.')
    } catch (err) {
      setStatus(err.message)
    }
    setBusy(false)
  }

  // Reads the chosen file in the browser (nothing is sent yet) and asks to confirm.
  async function pickFile(e) {
    const file = e.target.files[0]
    e.target.value = '' // so picking the same file again still fires onChange
    if (!file) return
    try {
      setBackup({ name: file.name, data: JSON.parse(await file.text()) })
      setStatus(null)
    } catch {
      setStatus("That file isn't valid JSON.")
    }
  }

  async function restore() {
    setBusy(true)
    try {
      // editPlan sends it, then reloads the plan; the ticks reload through Tracker.
      const result = await editPlan('/api/restore', { method: 'POST', body: backup.data })
      setStatus(`Imported ${backup.name}${result.journal ? ` (${result.journal} journal entries)` : ''}.`)
      setBackup(null)
    } catch (err) {
      setStatus(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="animate-fade-up space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800 text-center mb-5">Settings</h1>

      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-800">Export</h2>
        <p className="text-sm text-slate-500 mt-1 mb-3">Downloads the plan, every tick and the journal as one JSON file.</p>
        <button onClick={exportAll} disabled={busy} className={`${button} text-white bg-teal-600`}>Export</button>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-800">Import backup</h2>
        <p className="text-sm text-slate-500 mt-1 mb-3">
          Adds back everything from an exported file: tasks, ticks and journal entries are matched and updated, nothing is deleted.
          To roll the whole database back to a day, use <code>backend\scripts\restore.ps1</code> instead.
        </p>
        {!backup ? (
          <label className={`${button} inline-block cursor-pointer text-teal-600 bg-white border-2 border-teal-500`}>
            Choose file…
            <input type="file" accept=".json,application/json" onChange={pickFile} className="sr-only" />
          </label>
        ) : (
          <div className="animate-fade-up flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-700">Import <b>{backup.name}</b>?</span>
            <button onClick={restore} disabled={busy} className={`${button} text-white bg-teal-600`}>{busy ? 'Importing…' : 'Import'}</button>
            <button onClick={() => setBackup(null)} className={`${button} text-slate-500`}>Cancel</button>
          </div>
        )}
      </section>

      {status && <p className="animate-fade-up rounded-xl bg-amber-100 text-amber-800 text-sm px-4 py-3 whitespace-pre-line">{status}</p>}
    </div>
  )
}

export default Settings
