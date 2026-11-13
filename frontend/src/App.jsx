import { usePlan } from './hooks/usePlan'
import Tracker from './components/Tracker'

// A centred message for loading and errors. whitespace-pre-line keeps line breaks.
function Message({ children }) {
  return (
    <main className="min-h-screen bg-slate-50 py-20 px-4">
      <p className="text-center text-slate-500 whitespace-pre-line">{children}</p>
    </main>
  )
}

// App is the root component. It loads plan.json through the local data API,
// then shows the main screen (Tracker) once the plan has arrived.
function App() {
  const { plan, error, savePlan } = usePlan()

  if (error) return <Message>{`Couldn't load your plan.\n${error}`}</Message>
  if (!plan) return <Message>Loading your plan…</Message>
  return <Tracker plan={plan} savePlan={savePlan} />
}

export default App
