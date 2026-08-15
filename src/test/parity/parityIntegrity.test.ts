/// <reference types="node" />

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('parity fixture integrity', () => {
  it('matches every fixture and rejects missing or extra manifest entries', () => {
    const fixturesDirectory = fileURLToPath(new URL('./fixtures/', import.meta.url))
    const fixtureNames = readdirSync(fixturesDirectory)
      .filter(name => name.endsWith('.cases.json'))
      .sort()
    const expectedManifest = fixtureNames.map(name => {
      const fixture = readFileSync(new URL(`./fixtures/${name}`, import.meta.url))
      const hash = createHash('sha256').update(fixture).digest('hex')
      return `${hash}  ${name}`
    })
    const actualManifest = readFileSync(new URL('./manifest.sha256', import.meta.url), 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .sort()

    expect(actualManifest).toEqual(expectedManifest.sort())
  })
})
