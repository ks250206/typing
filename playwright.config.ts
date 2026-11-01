import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Longform sessions send thousands of real key events on shared CI runners.
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: {
    // CI builds dist/ in its own step, so only local runs build before serving.
    command: `${process.env.CI ? '' : 'pnpm build && '}pnpm preview --host 127.0.0.1 --port 4173 --strictPort`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  reporter: 'list',
})
