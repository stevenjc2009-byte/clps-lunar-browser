import { defineConfig } from '@playwright/test'

// Smoke + accessibility tests against the production build served by `vite preview`.
// Run `npm run build` first (the CI job and `npm run e2e` do).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5196', browserName: 'chromium', headless: true },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 5196 --strictPort',
    url: 'http://127.0.0.1:5196',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
