import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { dataApi } from './dev/dataApi.js'

// https://vite.dev/config/
export default defineConfig({
  // dataApi adds /api/plan and /api/progress to the dev server (see dev/dataApi.js).
  plugins: [react(), tailwindcss(), dataApi()],
  server: {
    // The browser's backup copy of ticks (localStorage) is separate for every port.
    // strictPort makes Vite stop with an error if 5173 is busy, instead of quietly
    // using 5174. Don't set server.host: the data API must stay on this laptop only.
    port: 5173,
    strictPort: true,
    // Saving plan.json / progress.json must not make Vite reload the page.
    watch: { ignored: ['**/frontend/data/**'] },
  },
})
