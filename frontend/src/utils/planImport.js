// The import format, as text for the "Copy format for Claude" button and the month
// wizard's prompt. The import itself runs on the backend (POST /api/import).
import { ROUTINE_TEMPLATES, TASK_TYPES } from './validatePlan.js'

// Short description of the format, for the "Copy format for Claude" button.
export const IMPORT_FORMAT_FOR_CLAUDE = `Please reply with JSON in this format for my Plan Tracker app (any of the three keys can be left out):

{
  "tasks": [
    { "date": "2026-12-21", "type": "learn", "time": "07:00-08:30",
      "text": "JavaScript functions and arrow functions", "resources": "MDN" }
  ],
  "weeks": [
    { "monthTitle": "Month 2: JavaScript, React, full-stack",
      "title": "Week 6: JavaScript basics", "start": "2026-12-21", "end": "2026-12-27",
      "goal": "Comfortable with functions, arrays, objects, the DOM and fetch." }
  ],
  "routine": {
    "weekday": [
      { "id": "coding-morning", "start": "07:00", "end": "08:30", "label": "Coding: learn",
        "kind": "coding", "taskType": "learn", "tickable": true }
    ]
  }
}

Rules:
- Dates are YYYY-MM-DD. Weeks run Monday to Sunday.
- Task "type" is one of: ${TASK_TYPES.join(', ')}.
- "time" is optional: "HH:MM-HH:MM" or free text like "Work hour".
- Routine template names: ${ROUTINE_TEMPLATES.join(', ')}. A template replaces my whole current template.
- Routine block times are HH:MM (24-hour); "end" is optional for one-moment blocks like wake up and sleep.
- Block "kind" is one of: wake, coding, french, work, meal, rest, fun, sleep. Blocks must not overlap.
- Don't include task ids; the app creates them.`
