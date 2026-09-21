import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('service worker update lifecycle', () => {
  it('lets an existing document keep its matching worker and precache', () => {
    const source = readFileSync(new URL('./sw.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('clientsClaim(')
    expect(source).toContain('cleanupOutdatedCaches()')
    expect(source).toContain("event.data?.type === 'SKIP_WAITING'")
    expect(source).toContain("type: 'PWA_SW_ACTIVATED'")
  })

  it('uses an explicit update prompt instead of the plugin automatic reload mode', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')

    expect(config).toContain("registerType: 'prompt'")
    expect(config).toContain('injectRegister: false')
  })
})
