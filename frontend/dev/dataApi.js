// Local data API. This is a Vite plugin: it adds a few URLs to the dev server
// (`npm run dev`) that read and write the JSON files in frontend/data/.
// It runs in Node (not in the browser), which is why it can use the fs module.
//
//   GET /api/plan       -> data/plan.json
//   PUT /api/plan       -> checks the plan with validatePlan, then saves it
//   GET /api/progress   -> data/progress.json ({} if the file doesn't exist yet)
//   PUT /api/progress   -> checks the ticks with validateProgress, then saves them
//
// There is no separate backend: this only exists while `npm run dev` is running.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePlan, validateProgress } from '../src/utils/validatePlan.js'

export const DATA_DIR = fileURLToPath(new URL('../data', import.meta.url))

// Each file the API knows about, with its checker and what to return if it's missing.
const FILES = {
  plan: { validate: validatePlan, whenMissing: null },
  progress: { validate: validateProgress, whenMissing: {} },
}

const MAX_BODY_BYTES = 5 * 1024 * 1024 // 5 MB, far more than the plan will ever need

function readData(name) {
  const file = path.join(DATA_DIR, `${name}.json`)
  if (!fs.existsSync(file) && FILES[name].whenMissing) return FILES[name].whenMissing
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

// Safe write: write a temporary file first, then rename it over the real one.
// A crash halfway through leaves a stray .tmp file, never a half-written plan.json.
// The previous version is copied to <name>.backup.json first.
// ponytail: one backup (the last version); git history is the long-term backup.
function writeData(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`)
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(DATA_DIR, `${name}.backup.json`))
  fs.renameSync(tmp, file)
}

// Collects the request body (it arrives in chunks) and parses it as JSON.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) reject(Object.assign(new Error('Body too large'), { status: 413 }))
      else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('Body is not valid JSON'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

export function dataApi() {
  return {
    name: 'plan-tracker-data-api',
    // configureServer runs once when `npm run dev` starts; we add our own handler
    // in front of Vite's. Anything that isn't /api/plan or /api/progress goes on to Vite.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url.match(/^\/api\/(plan|progress)\/?(\?.*)?$/)
        if (!match) return next()
        const name = match[1]

        try {
          if (req.method === 'GET') return send(res, 200, readData(name))

          if (req.method === 'PUT') {
            // Only accept JSON, so a plain HTML form on some other website can't post here.
            if (!req.headers['content-type']?.startsWith('application/json')) {
              return send(res, 415, { error: 'Send JSON (Content-Type: application/json)' })
            }
            const body = await readJsonBody(req)
            const errors = FILES[name].validate(body)
            if (errors.length) return send(res, 400, { errors })
            writeData(name, body)
            return send(res, 200, { ok: true })
          }

          send(res, 405, { error: 'Only GET and PUT are allowed' })
        } catch (err) {
          send(res, err.status ?? 500, { error: `${name}.json: ${err.message}` })
        }
      })
    },
  }
}
