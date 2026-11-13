import { useEffect, useState } from 'react'
import { usePlanActions } from '../PlanContext'
import { shortDate } from '../utils/planHelpers'
import {
  applyClaudeReply,
  buildMonth,
  claudePrompt,
  draftSummary,
  fillWithPattern,
  newDraft,
  overlappingMonths,
  syncDraft,
  wizardWeeks,
} from '../utils/monthWizard'
import { isValidDate } from '../utils/validatePlan'
import Modal from './Modal'
import WizardDays from './WizardDays'

const DRAFT_KEY = 'planTracker:monthDraft'
const STEPS = ['Basics', 'Weeks', 'Days and tasks', 'Preview and save']
const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500'
const label = 'block text-sm font-medium text-slate-600 mb-1'
const primary = 'text-sm font-semibold text-white bg-teal-600 rounded-full px-4 py-2 active:scale-95 transition disabled:opacity-40 disabled:active:scale-100'
const secondary = 'text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-200 rounded-full px-4 py-2 active:scale-95 transition'

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY))
  } catch {
    return null
  }
}

// The New month wizard: Basics -> Weeks -> Days and tasks -> Preview and save.
// Everything typed is kept in localStorage, so closing it doesn't lose work.
function MonthWizard({ today, onClose, onSaved }) {
  const { plan, editPlan } = usePlanActions()
  // useState with a function: it runs once, on the first render only.
  const [draft, setDraft] = useState(() => loadDraft() ?? newDraft(plan, today))
  const [pasting, setPasting] = useState(false)
  const [reply, setReply] = useState('')
  const [notice, setNotice] = useState(null) // { text, problems } after copy/paste
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)

  // useEffect with [draft]: save the draft to the browser after every change.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // storage blocked: the draft just won't survive closing the wizard
    }
  }, [draft])

  // Changes a copy of the draft. "change" may mutate the copy freely; React gets a new object.
  function edit(change) {
    setDraft((prev) => {
      const next = structuredClone(prev)
      change(next)
      return next
    })
  }

  // Moving between steps re-syncs weeks and days with the start date and week count.
  function goToStep(step) {
    setNotice(null)
    setDraft((prev) => ({ ...syncDraft(prev, plan), step }))
  }

  function discard() {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // nothing to remove
    }
    onClose()
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(claudePrompt(draft))
      setNotice({ text: 'Prompt copied. Paste it into Claude, then paste the reply here.' })
    } catch {
      setNotice({ text: "Couldn't copy to the clipboard.", problems: [] })
    }
  }

  function applyReply() {
    const result = applyClaudeReply(draft, reply)
    setDraft(result.draft)
    setNotice({ text: result.count ? `Filled ${result.count} tasks from Claude's reply. Check them below.` : null, problems: result.problems })
    if (result.count) {
      setPasting(false)
      setReply('')
    }
  }

  async function save(input) {
    setSaving(true)
    setSaveError(null)
    try {
      await editPlan('/api/import', { method: 'POST', body: input })
      localStorage.removeItem(DRAFT_KEY)
      onSaved()
    } catch (err) {
      setSaveError(err.message)
      setSaving(false)
    }
  }

  const step = draft.step
  const weeks = isValidDate(draft.start) ? wizardWeeks(draft.start, draft.weekCount) : []
  const end = weeks.at(-1)?.end
  const overlaps = end ? overlappingMonths(plan, draft.start, end) : []
  const basicsOk = draft.title.trim() && isValidDate(draft.start) && draft.weekCount >= 1
  const built = step === 4 ? buildMonth(plan, draft) : null

  return (
    <Modal title="New month" onClose={onClose} wide>
      {/* Step indicator */}
      <ol className="flex flex-wrap gap-2 mb-5 text-xs">
        {STEPS.map((name, i) => (
          <li
            key={name}
            className={`rounded-full px-3 py-1 font-medium ${i + 1 === step ? 'bg-teal-600 text-white' : i + 1 < step ? 'bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-400'}`}
          >
            {i + 1}. {name}
          </li>
        ))}
      </ol>

      {/* key={step}: each step fades in when it appears. */}
      <div key={step} className="animate-fade-up">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="wiz-title">Month title</label>
              <input
                id="wiz-title"
                className={input}
                placeholder="Month 2: JavaScript, React, full-stack"
                value={draft.title}
                onChange={(e) => edit((d) => (d.title = e.target.value))}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={label} htmlFor="wiz-start">Start date</label>
                <input id="wiz-start" type="date" className={input} value={draft.start} onChange={(e) => edit((d) => (d.start = e.target.value))} />
              </div>
              <div className="w-32">
                <label className={label} htmlFor="wiz-weeks">Weeks</label>
                <input
                  id="wiz-weeks"
                  type="number"
                  min="1"
                  max="8"
                  className={input}
                  value={draft.weekCount}
                  onChange={(e) => edit((d) => (d.weekCount = Math.max(1, Math.min(8, Number(e.target.value) || 1))))}
                />
              </div>
            </div>
            {weeks.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {weeks.map((w, i) => (
                  <p key={w.start}>
                    Week {i + 1}: {shortDate(w.start)} to {shortDate(w.end)}
                    {i === 0 && new Date(w.start + 'T00:00:00Z').getUTCDay() !== 1 && (
                      <span className="text-slate-400"> (short week)</span>
                    )}
                  </p>
                ))}
                <p className="mt-1 font-medium text-slate-700">The month ends on {shortDate(end)}.</p>
              </div>
            )}
            {overlaps.map((m) => (
              <p key={m.id} className="rounded-lg bg-amber-100 text-amber-800 text-sm px-3 py-2">
                These dates overlap "{m.title}" ({m.start} to {m.end}).
              </p>
            ))}
          </div>
        )}

        {step === 2 &&
          draft.weeks.map((w, i) => (
            <div key={w.start} className="mb-4">
              <p className="text-xs text-slate-400 mb-1">
                {shortDate(w.start)} to {shortDate(w.end)}
              </p>
              <input
                className={`${input} mb-1`}
                aria-label={`Week ${i + 1} title`}
                value={w.title}
                onChange={(e) => edit((d) => (d.weeks[i].title = e.target.value))}
              />
              <input
                className={input}
                placeholder="Goal for this week"
                aria-label={`Week ${i + 1} goal`}
                value={w.goal}
                onChange={(e) => edit((d) => (d.weeks[i].goal = e.target.value))}
              />
            </div>
          ))}

        {step === 3 && (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              <button className={secondary} onClick={() => setDraft(fillWithPattern(draft))}>Fill with my usual pattern</button>
              <button className={secondary} onClick={copyPrompt}>Ask Claude to fill it</button>
              <button className={secondary} onClick={() => setPasting(!pasting)}>Paste Claude's reply</button>
            </div>
            {pasting && (
              <div className="mb-3 animate-fade-up">
                <textarea
                  className={`${input} font-mono text-xs h-32`}
                  placeholder="Paste Claude's JSON reply here"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button className={`${primary} mt-2`} disabled={!reply.trim()} onClick={applyReply}>Fill the days</button>
              </div>
            )}
            {notice && (
              <div className="mb-3 rounded-lg bg-slate-50 text-sm text-slate-700 px-3 py-2">
                {notice.text && <p>{notice.text}</p>}
                {notice.problems?.map((p) => (
                  <p key={p} className="text-amber-800">{p}</p>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mb-3">Tasks left with empty text are not saved.</p>
            <WizardDays draft={draft} edit={edit} />
          </>
        )}

        {step === 4 && (
          <div>
            <p className="text-lg font-semibold text-slate-800 mb-3">{draftSummary(draft)}</p>
            {built.problems ? (
              <ul className="rounded-lg bg-amber-100 text-amber-800 text-sm px-4 py-3 list-disc list-inside space-y-1">
                {built.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Everything checks out. Saving adds it to plan.json.</p>
            )}
            {saveError && <p className="mt-3 rounded-lg bg-amber-100 text-amber-800 text-sm px-4 py-3 whitespace-pre-line">{saveError}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-slate-200">
        <button className="text-sm text-red-600 hover:underline" onClick={discard}>Discard draft</button>
        <div className="flex gap-2">
          {step > 1 && <button className={secondary} onClick={() => goToStep(step - 1)}>Back</button>}
          {step < 4 ? (
            <button className={primary} disabled={!basicsOk} onClick={() => goToStep(step + 1)}>Next</button>
          ) : (
            <button className={primary} disabled={!built.input || saving} onClick={() => save(built.input)}>
              {saving ? 'Saving…' : 'Save month'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default MonthWizard
