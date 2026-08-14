/// <reference types="node" />

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('parity fixture integrity', () => {
  it('matches the checked-in manifest', () => {
    const fixture = readFileSync(new URL('./fixtures/bucket-attribution.cases.json', import.meta.url))
    const manifest = readFileSync(new URL('./manifest.sha256', import.meta.url), 'utf8')
    const hash = createHash('sha256').update(fixture).digest('hex')
    expect(manifest).toContain(`${hash}  bucket-attribution.cases.json`)
  })
})
