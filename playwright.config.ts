import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 30000,
  use: { baseURL: 'http://localhost:5187', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ...(process.env.LUNA_WEBKIT === '1' ? [{ name: 'webkit-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' as const } }] : []),
  ],
  webServer: { command: 'npm run dev', url: 'http://localhost:5187', reuseExistingServer: false, timeout: 30000, env: { SESSION_SECRET: 'test-session-secret-abcdefghijklmnopqrstuvwxyz', ADMIN_SETUP_TOKEN: 'test-setup-token-abcdefghijklmnopqrstuvwxyz', DATABASE_PATH: '/tmp/luna-e2e.sqlite', MEDIA_PATH: '/tmp/luna-e2e-media', PUBLIC_ORIGIN: 'http://localhost:5187', PORT: '3087', VITE_PORT: '5187' } },
});
