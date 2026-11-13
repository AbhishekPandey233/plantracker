// Run with: npm run validate  (checks plan.json from the terminal)
import plan from '../src/data/plan.json' with { type: 'json' }
import { validatePlan } from '../src/utils/validatePlan.js'

const warnings = validatePlan(plan)
const tasks = plan.months.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.tasks)))
console.log(warnings.length ? `${warnings.length} warning(s)` : `plan.json OK: ${tasks.length} tasks`)
process.exit(warnings.length ? 1 : 0)
