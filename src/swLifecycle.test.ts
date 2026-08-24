import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('service worker update lifecycle', () => {
  it('lets an existing document keep its matching worker and precache', () => {
    const source = readFileSync(new URL('./sw.ts', import.meta.url), 'utf8')

    expect(source).not.toContain('skipWaiting(')
    expect(source).not.toContain('clientsClaim(')
    expect(source).toContain('cleanupOutdatedCaches()')
  })
})
