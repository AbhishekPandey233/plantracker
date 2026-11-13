// One small button for a tab. "active" controls which tab looks selected.
function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full font-medium transition-[background-color,color,transform] duration-200 active:scale-95 ${
        active ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

export default TabButton
