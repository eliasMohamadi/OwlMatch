import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against an isolated API (its own port + data directory) so it never
 * touches the demo database. Set RECORD=1 to save a video of every test.
 */
const API_PORT = 8790;
const WEB_PORT = 5190;
const LIVE_AI = Boolean(process.env.E2E_USE_GEMINI);

export default defineConfig({
  testDir: 'e2e',
  timeout: LIVE_AI ? 180_000 : 90_000,
  // Live Gemini calls take ~5–10 s each; give assertions room when they're on.
  expect: { timeout: LIVE_AI ? 30_000 : 5_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    video: process.env.RECORD ? { mode: 'on', size: { width: 430, height: 932 } } : 'off',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 430, height: 932 }, hasTouch: true } }],
  webServer: [
    {
      command: 'npx tsx server/index.ts',
      // Default: AI disabled for fast, deterministic runs. E2E_USE_GEMINI=1 lets the server read the key from .env.
      env: { PORT: String(API_PORT), OWLMATCH_DATA_DIR: '.e2e-data', OWLMATCH_SAMPLE_EVENTS: '1', ...(LIVE_AI ? {} : { GEMINI_API_KEY: '' }) },
      port: API_PORT,
      reuseExistingServer: false,
    },
    {
      command: 'npx vite',
      env: { PORT: String(API_PORT), WEB_PORT: String(WEB_PORT) },
      port: WEB_PORT,
      reuseExistingServer: false,
    },
  ],
});
