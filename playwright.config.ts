import { defineConfig, devices } from '@playwright/test'

const projects = [
  { name: 'mobile-light', viewport: { width: 390, height: 844 }, colorScheme: 'light' as const },
  { name: 'mobile-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark' as const },
  { name: 'medium-light', viewport: { width: 768, height: 1024 }, colorScheme: 'light' as const },
  { name: 'medium-dark', viewport: { width: 768, height: 1024 }, colorScheme: 'dark' as const },
  { name: 'desktop-light', viewport: { width: 1440, height: 900 }, colorScheme: 'light' as const },
  { name: 'desktop-dark', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' as const },
  { name: 'compact-320-light', viewport: { width: 320, height: 844 }, colorScheme: 'light' as const, testMatch: '**/responsive-contract.spec.ts' },
  { name: 'compact-keyboard-light', viewport: { width: 390, height: 500 }, colorScheme: 'light' as const, testMatch: '**/responsive-contract.spec.ts' },
  { name: 'medium-960-light', viewport: { width: 960, height: 900 }, colorScheme: 'light' as const, testMatch: '**/responsive-contract.spec.ts' },
  { name: 'medium-960-dark', viewport: { width: 960, height: 900 }, colorScheme: 'dark' as const, testMatch: '**/responsive-contract.spec.ts' },
  { name: 'expanded-1024-light', viewport: { width: 1024, height: 768 }, colorScheme: 'light' as const, testMatch: '**/responsive-contract.spec.ts' },
  { name: 'expanded-1024-dark', viewport: { width: 1024, height: 768 }, colorScheme: 'dark' as const, testMatch: '**/responsive-contract.spec.ts' },
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
      // Baselines carry no platform suffix, so one PNG is compared against both the Windows
      // workstation render and the Linux CI render. Inter is self-hosted, so the glyphs are
      // identical, but Chromium rasterises them through DirectWrite on Windows and FreeType on
      // Linux, so every glyph edge lands a shade differently. That floor scales with how much text
      // a page holds: the two densest mobile routes (Recurring, Vault) measured ~1.2% and so failed
      // CI at the old 1% cap for rendering nobody had changed. 2% keeps that noise inside the
      // tolerance while staying far below any real layout move, which shifts whole rows.
      maxDiffPixelRatio: 0.02,
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
    ...('testMatch' in project ? { testMatch: project.testMatch } : {}),
    use: {
      viewport: project.viewport,
      colorScheme: project.colorScheme,
      reducedMotion: 'reduce' as const,
      ...(project.name.startsWith('mobile') || project.name.startsWith('compact') ? {
        hasTouch: true,
        isMobile: true,
        serviceWorkers: 'allow' as const,
      } : {}),
    },
  })),
  webServer: {
    command: 'node ./scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
