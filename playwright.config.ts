import { defineConfig } from '@playwright/test';
import { E2E_DIR, E2E_CONFIG } from './e2e/paths';

/**
 * Tests e2e (Fase 10, item 70).
 * Levanta backend (puerto 3001, carpeta temporal aislada) + frontend (3000).
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: [
    {
      command: 'node ./node_modules/tsx/dist/cli.mjs src/backend/server.ts',
      port: 3001,
      reuseExistingWebServer: false,
      env: {
        NOTAS_FOLDER: E2E_DIR,
        NOTAS_CONFIG_PATH: E2E_CONFIG,
        PORT: '3001',
      },
    },
    {
      command: 'node ./node_modules/vite/bin/vite.js --config src/frontend/vite.config.ts --port 3000 --strictPort',
      port: 3000,
      reuseExistingWebServer: false,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
