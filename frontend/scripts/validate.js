// Run with: npm run validate
// Checks the plan in the database: asks the backend for it (GET /api/plan) and runs
// the same checks the app uses. The backend must be running (start-dev.ps1).
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { validatePlan, validateProgress } from '../src/utils/validatePlan.js'

const env = loadEnv('development', fileURLToPath(new URL('..', import.meta.url)), '')
const headers = { 'X-API-Key': env.API_KEY ?? '' }

async function get(path) {
  let res
  try {
    res = await fetch(`http://127.0.0.1:8000${path}`, { headers })
  } catch {
    console.error("Backend isn't running. Start it with .\\start-dev.ps1 in the project folder.")
    process.exit(1)
  }
  if (!res.ok) {
    console.error(`GET ${path} failed: ${res.status} ${(await res.json().catch(() => null))?.error ?? ''}`)
    process.exit(1)
  }
  return res.json()
}

const plan = await get('/api/plan')
const progress = await get('/api/progress')
const warnings = [...validatePlan(plan, { quiet: true }), ...validateProgress(progress)]
for (const w of warnings) console.log(`- ${w}`)

const tasks = plan.months.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks)))
const routine = Object.entries(plan.routine ?? {})
  .map(([name, blocks]) => `${name} ${blocks.length} blocks`)
  .join(', ')

if (warnings.length) {
  console.log(`${warnings.length} warning(s)`)
  process.exit(1)
}
console.log(`Plan OK: ${plan.months.length} month(s), ${tasks.length} tasks, ${Object.keys(progress).length} ticks`)
console.log(`routine: ${routine || 'none'}`)
