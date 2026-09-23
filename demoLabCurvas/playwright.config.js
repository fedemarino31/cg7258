import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  retries: 1,
  use: { baseURL: 'http://127.0.0.1:10001', viewport: { width: 1280, height: 720 }, channel: 'msedge' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 10001',
    url: 'http://127.0.0.1:10001',
    reuseExistingServer: true,
  },
  reporter: 'line',
});
