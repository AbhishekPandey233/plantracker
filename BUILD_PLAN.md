# Plan Tracker: Build Plan for Claude Code

You are helping me build a personal plan tracker app. Read this whole file first, then work through the phases **one at a time**.

## About me and this project

- I'm Abhishek, a junior developer learning React. Explain things simply and add short comments in code where React concepts appear (hooks, state, props).
- I use a **Windows laptop** (VS Code, PowerShell) and an **iPhone**.
- The app shows my 6-month study plan as weeks and days with **tickable tasks**.
- **I am the only user.** No backend, no login, no database, no user accounts.

## How to work with me

1. Do **one phase at a time**. When a phase is done, stop and tell me:
   - what you changed (short list of files),
   - how to check it works (the "Check" for that phase),
   - a suggested git commit message.
   Then **wait for me to say "next"** before starting the next phase.
2. Explain every terminal command you run in one line.
3. Use **JavaScript, not TypeScript**. Keep components small, one per file.
4. Don't add libraries beyond React, Vite and Tailwind unless you ask me first.
5. When a phase is done, tick it in the **Progress** list at the bottom of this file.

## Tech stack

| Piece | Choice |
| --- | --- |
| Framework | React with Vite (JavaScript) |
| Styling | Tailwind CSS |
| Plan data | `src/data/plan.json` |
| Ticks (progress) | Browser `localStorage`, keyed by task id |
| Instructions for future requests | `CLAUDE.md` in the project root |

## Data format: `src/data/plan.json`

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
                },
                {
                  "id": "2026-11-18-practise",
                  "type": "practise",
                  "time": "Work hour",
                  "text": "Git init, add, commit, push; create the learning-journey repo",
                  "resources": ""
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

Rules for this data:

- `type` is one of `learn`, `practise`, `project`, `review`.
- Task id format is `<date>-<type>`, e.g. `2026-11-18-learn`. If a day has two tasks of the same type, add `-2`, `-3`.
- **Never change or reuse an existing task id.** My ticks are saved by id.
- Dates are always `YYYY-MM-DD`. Weeks run Monday to Sunday unless I say otherwise.
- After every edit, make sure `plan.json` is valid JSON.

---

## Phase 1: Create the project

- Create a React app in this folder with Vite (JavaScript) and set up Tailwind CSS.
- Create folders: `src/data/`, `src/components/`, `src/hooks/`, `src/utils/`.
- Replace the starter page with a simple "Plan Tracker" heading styled with Tailwind.
- Initialise git with a sensible `.gitignore` and write a short README on how to run the app.

**Check:** `npm run dev` shows a styled "Plan Tracker" heading.

## Phase 2: Data file, CLAUDE.md and validator

- Create `src/data/plan.json` using the format above, with one sample week of two days.
- Create `CLAUDE.md` in the project root explaining:
  - what this app is and that I'm the only user,
  - the `plan.json` format and its rules (copy them from this file),
  - that when I ask to add or change weeks, days or tasks, you **only edit `plan.json`**, not the components,
  - that `BUILD_PLAN.md` is the original build plan.
- Create `src/utils/validatePlan.js` that checks for duplicate task ids and invalid dates and logs clear warnings in the browser console.

**Check:** I can read `CLAUDE.md` and `plan.json` and understand the format.

## Phase 3: Load Month 1

- Read `month1.md` in the project folder (my Month 1 daily coding plan, 18 Nov to 20 Dec 2026, five weekly tables).
- Convert it into `plan.json`, replacing the sample data:
  - one month: "Month 1: Interview essentials", 2026-11-18 to 2026-12-20,
  - five weeks, using each table heading as the week title and the sentence under it as the goal,
  - weekdays: a `learn` task (time "7:00-8:30") from the Morning column and a `practise` task (time "Work hour") from the Work hour column, with the Resources column copied into `resources`,
  - Saturdays: one `project` task (time "3 hrs"),
  - Sundays: one `review` task.
- Tell me how many days and tasks you added, and run the validator.

**Check:** 33 days added, no validator warnings.

## Phase 4: Tickable week view

- A week selector at the top: previous / next buttons, week title and dates.
- One card per day: date, day name, focus.
- Each task as a row: checkbox, coloured type label, time, text, and resources in smaller grey text.
- Ticks saved in `localStorage` by task id, using a custom hook in `src/hooks/useProgress.js`.
- Ticked tasks show strikethrough and lower opacity. A day with all tasks ticked shows a green "Done" badge.

**Check:** tick some tasks, refresh, they stay ticked.

## Phase 5: Today view and progress

- A **Today** view that the app opens on:
  - today's tasks (matched by date) at the top, large and easy to tick,
  - if today has no tasks, show the next day that does,
  - unticked tasks from earlier days listed under "Catch up".
- Progress bars for the current week and current month (ticked / total).
- A streak counter: days in a row with every task ticked, counting back from yesterday (today counts once complete).
- Tabs at the top to switch between **Today** and **Weeks**.

**Check:** the app opens on today's tasks; ticking one updates the progress bars.

## Phase 6: Design polish

- Calm, minimal design: white space, rounded cards, soft shadows, one accent colour.
- Consistent colour per task type, used on the label and the left border of each task row.
- Dark mode following the system setting, with good text contrast in both modes.
- Mobile-first: full-width cards on phones, a centred column on laptops, checkboxes large enough to tap.
- Today's card highlighted in the Weeks view.
- A friendly empty state when a week has no tasks.
- Don't change `plan.json` or the `localStorage` format.

**Check:** looks good at phone size in DevTools, in both light and dark mode.

## Phase 7: Settings, backup and moving ticks between devices

Add a **Settings** tab with:

- **Export progress:** download ticks as `progress-YYYY-MM-DD.json`.
- **Import progress:** load that file and merge it with current ticks (a tick on either side stays ticked); show how many were imported.
- **Reset progress:** clear all ticks after a confirmation dialog.
- A warning box if `validatePlan.js` finds problems in `plan.json`.

**Check:** export, reset, import, and the ticks come back.

## Phase 8: Use it on my iPhone

- Make the app installable as a PWA: web app manifest (name "Plan Tracker", a simple icon, theme colour matching the design) and the iOS meta tags so "Add to Home Screen" opens it full screen.
- Walk me step by step through deploying it free on Netlify from my GitHub repo. I'll create the GitHub repo myself; tell me exactly when and what to click.
- Set it up so every push to `main` redeploys automatically.

**Check:** the site opens in Safari on my iPhone, and Share → Add to Home Screen opens it from an icon.

---

## After the build: handling my everyday requests

Once all phases are done, I'll ask for things like:

- "Add Week 6 (21–27 Dec) to Month 2: JavaScript basics…" followed by one line per day.
- "Read month2.md and add it as Month 2, the same way as Month 1."
- "On 3 Dec, change the learn task to …"
- "I missed 25–26 Nov. Move their unfinished tasks to the next two Sundays."

For these, follow `CLAUDE.md`: only edit `plan.json`, never change existing task ids, run the validator, and tell me what you changed. If I ask for a new feature in the app itself, that's fine to change components.

## Progress

- [x] Phase 1: Create the project
- [x] Phase 2: Data file, CLAUDE.md and validator
- [x] Phase 3: Load Month 1
- [ ] Phase 4: Tickable week view
- [x] Phase 5: Today view and progress
- [x] Phase 6: Design polish
- [ ] Phase 7: Settings, backup and moving ticks between devices
- [ ] Phase 8: Use it on my iPhone
