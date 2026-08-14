/// <reference types="node" />

import { readFileSync } from 'node:fs'

export type BucketAttributionCase = {
  id: string
  why: string
  input: {
    transaction: {
      amount: number
      ledgerCategory: string | null
      category: string | null
    }
    bucket: string
  }
  expected: number
}

type Fixture = {
  domain: string
  version: number
  cases: BucketAttributionCase[]
}

export function forEachCase(domain: string): BucketAttributionCase[] {
  const fixture = JSON.parse(
    readFileSync(new URL(`./fixtures/${domain}.cases.json`, import.meta.url), 'utf8'),
  ) as Fixture
  if (fixture.domain !== domain || fixture.version !== 1) {
    throw new Error(`Unsupported parity fixture: ${domain}`)
  }
  return fixture.cases
}
