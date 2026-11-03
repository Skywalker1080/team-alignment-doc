import { defineConfig } from '@playwright/test';

const BASIC = 'http://127.0.0.1:4173';
const EMPTY = 'http://127.0.0.1:4174';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  reporter: 'list',
  use: { viewport: { width: 1280, height: 900 } },
  // One server process builds both fixtures one after the other (they share
  // dashboard/src/generated/bundle.json) and previews each on its own port.
  webServer: {
    command: 'npx tsx tests/e2e/serve.ts',
    url: BASIC,
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
  projects: [
    { name: 'basic', testMatch: 'dashboard.spec.ts', use: { baseURL: BASIC } },
    { name: 'empty', testMatch: 'empty.spec.ts', use: { baseURL: EMPTY } },
  ],
});
