import { formatClock } from '../utils/timeHelpers'
import ProgressSummary from './ProgressSummary'

// Small line icons (24x24 SVG paths), so no icon library is needed.
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  today: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  weeks: 'M4 6h16M4 12h16M4 18h16',
  months: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  collapse: 'M15 6l-6 6 6 6',
  expand: 'M9 6l6 6-6 6',
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  )
}

const NAV = [
  { view: 'home', label: 'Home', key: 'G' },
  { view: 'today', label: 'Today', key: 'T' },
  { view: 'weeks', label: 'Weeks', key: 'W' },
  { view: 'months', label: 'Months', key: 'M' },
  { view: 'history', label: 'History', key: 'H' },
]

// The left side panel: app name and clock, navigation, the progress area (Phases 2-3)
// and the New month button. Props come from Tracker; "collapsed" shrinks it to icons only.
function Sidebar({ now, view, onChangeView, collapsed, onToggle, onNewMonth, summary, onMissedClick, children }) {
  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 flex flex-col bg-white/60 border-r border-slate-200 py-5 transition-[width] duration-300 ${
        collapsed ? 'w-16 px-2' : 'w-60 px-4'
      }`}
    >
      <div className={`flex items-start mb-6 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="animate-fade-up">
            <h1 className="text-xl font-bold text-teal-600">Plan Tracker</h1>
            <p className="text-xs font-medium text-slate-500 tabular-nums mt-0.5">{formatClock(now)}</p>
          </div>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand side panel' : 'Collapse side panel'}
          title={`${collapsed ? 'Expand' : 'Collapse'} panel ( [ )`}
          className="h-8 w-8 grid place-items-center rounded-full text-slate-500 hover:bg-slate-200 transition active:scale-95"
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = view === item.view
          return (
            <button
              key={item.view}
              onClick={() => onChangeView(item.view)}
              title={`${item.label} (${item.key})`}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl py-2 font-medium transition-[background-color,color,transform] duration-200 active:scale-95 ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${active ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              <Icon name={item.view} />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && <kbd className={`text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>{item.key}</kbd>}
            </button>
          )
        })}
      </nav>

      {/* Progress summary and mini calendar ("children", passed in by Tracker).
          Collapsed: just a small "days done" badge. */}
      <div className="flex-1 overflow-y-auto my-4 -mx-1 px-1">
        {collapsed ? (
          <p title="Days done" className="text-center text-[11px] font-semibold text-slate-600 bg-slate-200 rounded-full py-1 tabular-nums">
            {summary.completedDays}/{summary.plannedDays}
          </p>
        ) : (
          <>
            <ProgressSummary summary={summary} onMissedClick={onMissedClick} />
            {children}
          </>
        )}
      </div>

      <button
        onClick={onNewMonth}
        title="New month"
        className={`flex items-center gap-2 rounded-xl py-2 font-medium text-teal-600 border-2 border-dashed border-teal-400 hover:bg-white transition active:scale-95 ${
          collapsed ? 'justify-center px-0' : 'justify-center px-3'
        }`}
      >
        <Icon name="plus" />
        {!collapsed && 'New month'}
      </button>
    </aside>
  )
}

export default Sidebar
