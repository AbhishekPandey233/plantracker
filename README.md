# Plan Tracker

A personal app that shows my 6-month study plan as weeks and days with tickable tasks.
No backend or login: ticks are saved in the browser's `localStorage`.

## Run it

```powershell
cd frontend
npm install      # first time only
npm run dev      # open the URL it prints (usually http://localhost:5173)
```

## Build for production

```powershell
cd frontend
npm run build    # output goes to frontend/dist
```

## Where things live

- `frontend/` is the React + Vite + Tailwind app
- `frontend/src/data/plan.json` holds the plan data (added in Phase 2)
- `BUILD_PLAN.md` is the original build plan
