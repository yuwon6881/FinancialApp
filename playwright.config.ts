import { defineConfig, devices } from '@playwright/test'

const projects = [
  { name: 'mobile-light', viewport: { width: 390, height: 844 }, colorScheme: 'light' as const },
  { name: 'mobile-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' as const },
  { name: 'medium-light', viewport: { width: 768, height: 1024 }, colorScheme: 'light' as const },
  { name: 'medium-dark', viewport: { width: 768, height: 1024 }, colorScheme: 'dark' as const },
  { name: 'desktop-light', viewport: { width: 1440, height: 900 }, colorScheme: 'light' as const },
  { name: 'desktop-dark', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' as const },
]

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 2,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-MY',
    timezoneId: 'Asia/Kuala_Lumpur',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    // Use the full Chrome-for-Testing binary. The smaller headless-shell binary
    // is blocked by endpoint security on the Windows development workstation.
    channel: 'chromium',
  },
  projects: projects.map(project => ({
    name: project.name,
    use: {
      viewport: project.viewport,
      colorScheme: project.colorScheme,
    },
  })),
  webServer: {
    command: 'node ./scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
