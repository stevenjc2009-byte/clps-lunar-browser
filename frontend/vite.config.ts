import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// Short commit hash shown in the page footer; "dev" when git is not available.
function buildCommit(): string {
  try {
    const h = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return /^[0-9a-f]{4,40}$/.test(h) ? h : 'dev'
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the built site works at any address (Netlify, Vercel, GitHub Pages sub-folder).
  base: './',
  plugins: [react()],
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  // Playwright specs live in e2e/ and run with `npm run e2e`, not vitest.
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
})
