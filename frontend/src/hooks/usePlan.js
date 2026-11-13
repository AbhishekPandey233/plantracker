import { useCallback, useEffect, useState } from 'react'
import { api } from '../utils/api'
import { validatePlan } from '../utils/validatePlan'

// Custom hook: loads plan.json from the local data API once, when the app starts,
// and saves changes back to it.
// Returns { plan, error, savePlan }: plan is null while loading, error is a message if loading failed.
export function usePlan() {
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)

  // useEffect with [] runs once after the first render: the right place to fetch data.
  useEffect(() => {
    api('/api/plan')
      .then((data) => {
        validatePlan(data) // problems show as warnings in the browser console
        setPlan(data)
      })
      .catch((err) => setError(err.message))
  }, [])

  // Saves a changed plan to plan.json. The server checks it first; if it refuses,
  // this throws with the server's list of problems (the form shows them).
  // The page only updates once the file has really been saved.
  const savePlan = useCallback(async (next) => {
    await api('/api/plan', next)
    setPlan(next)
  }, [])

  return { plan, error, savePlan }
}
