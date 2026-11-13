import { createContext, useContext } from 'react'

// React Context: a way to share values with every component below a Provider,
// without passing them down as props through each level in between.
// Tracker.jsx provides { plan, editPlan, isDone, toggle, setMany, openTaskForm }.
export const PlanContext = createContext(null)

// Any component can call usePlanActions() to get those values.
export function usePlanActions() {
  return useContext(PlanContext)
}
