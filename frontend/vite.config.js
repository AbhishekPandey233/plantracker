import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { apiGuard, apiProxy } from './dev/apiProxy.js'

const FRONTEND_DIR = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // loadEnv with prefix '' reads every variable in frontend/.env.local, not only VITE_ ones.
  // API_KEY has no VITE_ prefix on purpose: Vite only puts VITE_ variables into the
  // browser code, so the key stays here in Node.
  const env = loadEnv(mode, FRONTEND_DIR, '')
  if (command === 'serve' && !env.API_KEY) {
    throw new Error('API_KEY is missing. Copy frontend/.env.example to frontend/.env.local and paste API_KEY from backend/.env.')
  }

  return {
    plugins: [react(), tailwindcss(), apiGuard()],
    server: {
      // strictPort makes Vite stop with an error if 5173 is busy, instead of quietly
      // using 5174 (the backend only accepts the app from port 5173).
      // Don't set server.host: the dev server must stay on this laptop only.
      port: 5173,
      strictPort: true,
      proxy: apiProxy(env.API_KEY),
    },
  }
})
