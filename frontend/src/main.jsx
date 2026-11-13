import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import plan from './data/plan.json'
import { validatePlan } from './utils/validatePlan.js'

// Check plan.json once on startup; problems show as warnings in the browser console.
validatePlan(plan)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
