import { useCallback, useEffect, useState } from 'react'
import { api } from '../utils/api'
import { validatePlan } from '../utils/validatePlan'

// Custom hook: loads the plan from the backend when the app starts.
// Returns { plan, error, editPlan }: plan is null while loading, error is a message if loading failed.
export function usePlan() {
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)

  // useCallback with []: the same function on every render, so it's safe in useEffect's list.
  const reload = useCallback(
    () =>
      api('/api/plan').then((data) => {
        validatePlan(data) // problems show as warnings in the browser console
        setPlan(data)
      }),
    [],
  )

  // useEffect with [reload] runs once after the first render: the right place to fetch data.
  useEffect(() => {
    reload().catch((err) => setError(err.message))
  }, [reload])

  // Changes the plan on the server, e.g. editPlan('/api/tasks', { method: 'POST', body }),
  // then loads the new plan. The server does the work (ids, new weeks, checks) and
  // refuses with a message if the change isn't allowed; that error is thrown on to
  // the form that asked. The page only updates once the change is really saved.
  const editPlan = useCallback(
    async (url, options) => {
      const result = await api(url, options)
      await reload()
      return result
    },
    [reload],
  )

  return { plan, error, editPlan }
}
