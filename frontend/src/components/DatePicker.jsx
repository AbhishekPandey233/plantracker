import { useEffect, useRef, useState } from 'react'
import { calendarRows, monthBounds, shortDate } from '../utils/planHelpers'
import { currentMoment, kathmanduParts } from '../utils/timeHelpers'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const navButton = 'h-7 w-7 rounded-full text-slate-500 hover:bg-slate-200 transition active:scale-90'

// A themed date picker, used instead of <input type="date"> (the browser's own pop-up can't be styled).
// Props: value ('YYYY-MM-DD' or ''), onChange(date) gets the picked date string,
// className styles the button that shows the date, align: 'left' or 'right' edge for the pop-up.
function DatePicker({ value, onChange, className = '', align = 'left', label = 'Pick a date' }) {
  const today = kathmanduParts(currentMoment()).date
  const [open, setOpen] = useState(false)
  // useState: which month the pop-up shows, as months away from the value's month (or today's).
  const [offset, setOffset] = useState(0)
  const ref = useRef(null) // the outer element, to detect clicks outside it

  // Close on a click outside or Escape (same pattern as Menu.jsx).
  useEffect(() => {
    if (!open) return
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const { start, end } = monthBounds((value || today).slice(0, 7), offset)
  const title = new Date(start + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

  const pick = (date) => {
    onChange(date)
    setOpen(false)
  }

  return (
    // data-picker-open: index.css un-fades and raises the cards around an open picker.
    <div ref={ref} className="relative" data-picker-open={open || undefined}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setOffset(0) // always open on the chosen month
          setOpen(!open)
        }}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={value ? '' : 'text-slate-400'}>{value ? shortDate(value) + ' ' + value.slice(0, 4) : 'Pick a date'}</span>
        {/* Calendar icon (inline SVG); stroke="currentColor" takes the brown text colour. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true">
          <rect x="3.75" y="5.25" width="16.5" height="15" rx="2" />
          <path strokeLinecap="round" d="M3.75 9.75h16.5M8.25 3v4.5M15.75 3v4.5" />
        </svg>
      </button>

      {open && (
        <div
          className={`animate-pop absolute z-40 mt-2 w-64 rounded-xl bg-white p-3 shadow-lg ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" className={navButton} onClick={() => setOffset(offset - 1)} aria-label="Previous month">‹</button>
            <span className="text-sm font-semibold text-slate-700">{title}</span>
            <button type="button" className={navButton} onClick={() => setOffset(offset + 1)} aria-label="Next month">›</button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[10px] font-medium text-slate-400 pb-1">{w}</span>
            ))}
            {calendarRows(start, end).flat().map((date) => {
              const inMonth = date >= start && date <= end
              const chosen = date === value
              return (
                <button
                  type="button"
                  key={date}
                  onClick={() => pick(date)}
                  className={`h-8 rounded-lg text-xs tabular-nums transition active:scale-90 ${
                    chosen
                      ? 'bg-teal-600 font-bold text-white'
                      : date === today
                        ? 'font-bold text-teal-600 ring-1 ring-teal-500 hover:bg-slate-200'
                        : inMonth
                          ? 'text-slate-700 hover:bg-slate-200'
                          : 'text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {Number(date.slice(8))}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex justify-end">
            <button type="button" className="text-xs font-medium text-teal-600 hover:text-teal-700" onClick={() => pick(today)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
