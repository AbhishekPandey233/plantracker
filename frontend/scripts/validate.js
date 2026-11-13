// Run with: npm run validate  (checks plan.json from the terminal)
import plan from '../data/plan.json' with { type: 'json' }
import { validatePlan } from '../src/utils/validatePlan.js'

const warnings = validatePlan(plan)
const tasks = plan.months.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks)))
const routine = Object.entries(plan.routine ?? {})
  .map(([name, blocks]) => `${name} ${blocks.length} blocks`)
  .join(', ')

if (warnings.length) {
  console.log(`${warnings.length} warning(s)`)
  process.exit(1)
}
console.log(`plan.json OK: ${tasks.length} tasks`)
console.log(`routine: ${routine || 'none'}`)
