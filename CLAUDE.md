# Plan Tracker

A personal app that shows Abhishek's 6-month study plan as weeks and days with tickable tasks.

- **Abhishek is the only user.** No backend, no login, no database, no user accounts.
- Ticks (progress) are saved in the browser's `localStorage`, keyed by task id.
- `BUILD_PLAN.md` is the original build plan (phases, tech stack, progress list).
- Abhishek is a junior developer learning React: explain simply, add short comments where React concepts appear (hooks, state, props).
- Windows + PowerShell. Explain every terminal command in one line.

## Project layout

- `frontend/` is the React + Vite + Tailwind app (JavaScript, not TypeScript). Run commands from here.
- `frontend/src/data/plan.json` holds **all plan data**.
- `frontend/src/utils/validatePlan.js` checks `plan.json` (duplicate ids, bad dates, bad types).
- `backend/` is empty on purpose; there is no backend.

## Editing the plan: the main rule

When Abhishek asks to add or change months, weeks, days or tasks, **only edit `frontend/src/data/plan.json`**. Don't touch the components.
After every edit:

1. Make sure `plan.json` is valid JSON and run `npm run validate` in `frontend/`.
2. Tell him what changed (days and tasks added, modified or moved).

If he asks for a new feature in the app itself, changing components is fine.

## `plan.json` format

```json
{
  "months": [
    {
      "id": "m1",
      "title": "Month 1: Interview essentials",
      "start": "2026-11-18",
      "end": "2026-12-20",
      "weeks": [
        {
          "id": "m1-w1",
          "title": "Week 1: Setup, Git, Python core",
          "start": "2026-11-18",
          "end": "2026-11-22",
          "goal": "Laptop ready for development and first Python project on GitHub.",
          "days": [
            {
              "date": "2026-11-18",
              "focus": "Tools setup",
              "tasks": [
                {
                  "id": "2026-11-18-learn",
                  "type": "learn",
                  "time": "7:00-8:30",
                  "text": "Install VS Code, Python 3.12, Git for Windows, Windows Terminal; GitHub account and SSH key",
                  "resources": "Git official docs; GitHub Docs"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Rules for this data

- `type` is one of `learn`, `practise`, `project`, `review`.
- Task id format is `<date>-<type>`, e.g. `2026-11-18-learn`. If a day has two tasks of the same type, add `-2`, `-3`.
- **Never change or reuse an existing task id.** Ticks are saved by id. A task moved to another day keeps its original id.
- Dates are always `YYYY-MM-DD`. Weeks run Monday to Sunday unless Abhishek says otherwise.
- After every edit, make sure `plan.json` is valid JSON.
