import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [{ command: 'npx --yes firebase-tools@15.33.0 emulators:start --only auth --project demo-raiox --config tests/auth-emulator.json', port: 9099, reuseExistingServer: false, timeout: 120000 }, {
    command: 'npm run start -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false,
    timeout: 120000,
    env: { FIREBASE_WEB_API_KEY: 'demo-key', FIREBASE_WEB_APP_ID: 'demo-app', FIREBASE_AUTH_DOMAIN: 'localhost', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_PROJECT_ID: 'demo-raiox', FIREBASE_SERVICE_ACCOUNT_JSON: '', SQLITE_PATH: join(tmpdir(), `raiox-e2e-${Date.now()}.db`), AI_MODE: 'mock', SESSION_SECRET: 'e2e-session-secret-unique-32-characters', RATE_LIMIT_SECRET: 'e2e-rate-secret-unique-32-characters' },
  }],
});
