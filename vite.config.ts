import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  // Non-VITE_ values are read here only to configure the dev proxy; they never reach the browser.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = `http://localhost:${env.API_PORT || 3001}`
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  }

  return {
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(version) },
    server: {
      host: '0.0.0.0',
      proxy,
    },
    preview: { proxy },
  }
})
