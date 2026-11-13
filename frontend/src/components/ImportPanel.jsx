import { useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { IMPORT_FORMAT_FOR_CLAUDE, ImportError, importIntoPlan } from '../utils/planImport'
import Modal from './Modal'

const button = 'px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95'

// "Import from Claude": paste JSON, see a preview, then Save or Cancel.
function ImportPanel({ onClose }) {
  const { plan, savePlan } = usePlanActions()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // { plan, summary } once previewed
  const [problems, setProblems] = useState([])
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  function preview() {
    setProblems([])
    try {
      setResult(importIntoPlan(plan, JSON.parse(text)))
    } catch (err) {
      if (err instanceof ImportError) setProblems(err.problems)
      else if (err instanceof SyntaxError) setProblems([`That isn't valid JSON: ${err.message}`])
      else setProblems([err.message])
    }
  }

  async function save() {
    setSaving(true)
    try {
      await savePlan(result.plan)
      onClose()
    } catch (err) {
      setProblems(err.message.split('\n'))
      setResult(null)
      setSaving(false)
    }
  }

  async function copyFormat() {
    await navigator.clipboard.writeText(IMPORT_FORMAT_FOR_CLAUDE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const summary = result?.summary
  // Group the preview's tasks by date: { '2026-12-21': [task, task], ... }
  const tasksByDate = {}
  for (const t of summary?.tasks ?? []) (tasksByDate[t.date] ??= []).push(t)

  return (
    <Modal title="Import from Claude" onClose={onClose}>
      {!result ? (
        <>
          <p className="text-sm text-slate-600 mb-2">
            Paste the JSON Claude gave you. Not sure of the format? Copy it and paste it into your Claude chat.
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder='{ "tasks": [ { "date": "2026-12-21", "type": "learn", "text": "..." } ] }'
            className="w-full font-mono text-xs border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <div className="flex flex-wrap justify-between gap-2 mt-3">
            <button onClick={copyFormat} className={`${button} text-slate-600 hover:bg-slate-50`}>
              {copied ? 'Copied ✓' : 'Copy format for Claude'}
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className={`${button} text-slate-600 hover:bg-slate-50`}>Cancel</button>
              <button onClick={preview} disabled={!text.trim()} className={`${button} bg-teal-600 text-white disabled:opacity-50`}>Preview</button>
            </div>
          </div>
        </>
      ) : (
        <div className="animate-fade-up">
          <p className="font-medium text-slate-800">
            Adds {summary.tasks.length} task{summary.tasks.length === 1 ? '' : 's'}, {summary.newWeeks.length} week
            {summary.newWeeks.length === 1 ? '' : 's'}, {summary.routine.length} routine change{summary.routine.length === 1 ? '' : 's'}
          </p>
          <ul className="text-sm text-slate-600 mt-1 space-y-0.5">
            {summary.newWeeks.map((w) => <li key={w}>New week: {w}</li>)}
            {summary.updatedWeeks.map((w) => <li key={w}>Updated week: {w}</li>)}
            {summary.routine.map((r) => <li key={r}>Replaces the {r} routine</li>)}
          </ul>
          <div className="max-h-72 overflow-y-auto mt-3 space-y-3">
            {Object.entries(tasksByDate).map(([date, tasks]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-slate-500">{date}</p>
                <ul className="text-sm text-slate-700">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <span className="text-xs uppercase font-semibold text-slate-400 mr-2">{t.type}</span>
                      {t.time && <span className="text-xs text-slate-400 mr-2">{t.time}</span>}
                      {t.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setResult(null)} className={`${button} text-slate-600 hover:bg-slate-50`}>Back</button>
            <button onClick={onClose} className={`${button} text-slate-600 hover:bg-slate-50`}>Cancel</button>
            <button onClick={save} disabled={saving} className={`${button} bg-teal-600 text-white disabled:opacity-50`}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <ul className="mt-3 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2 list-disc list-inside max-h-48 overflow-y-auto">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </Modal>
  )
}

export default ImportPanel
