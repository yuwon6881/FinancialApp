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

export type GoalPacingCase = {
  id: string
  why: string
  input: {
    today: string
    targetDate: string
    cycleDay: number
    currentCycleKey: string
    goal: {
      id: number
      targetAmount: number
      earmarkedAmount: number
      cycleFundedKey: string | null
      cycleFundedAmount: number
      status: string
    }
  }
  expected: {
    remaining: number
    cyclesRemaining: number
    requiredPerCycle: number
    fundedThisCycle: number
    outstandingThisCycle: number
    isOverdue: boolean
    isFunded: boolean
  }
}

export type FreeRewardsCase = {
  id: string
  why: string
  input: {
    rewardsBalance: number
    pendingRewards: number
    goals: Array<{
      status: string
      fundingBucket: string
      earmarkedAmount: number
      isPendingDelete: boolean
    }>
    pendingOccurrences: Array<{
      status: 'Pending' | 'PartiallyPaid' | 'Paid'
      ledgerCategory: string
      category: string
      scheduledAmount: number
      paidAmount?: number
      remainingAmount?: number
      occurrenceDate?: string
    }>
  }
  expected: { pendingRewards: number; unassigned: number }
}

type Fixture<T> = {
  domain: string
  version: number
  cases: T[]
}

// Fixtures are version 1 unless a shape change bumped them. Pinning the version is what makes a
// fixture edit that either side has not caught up with fail loudly instead of silently skipping.
const FIXTURE_VERSIONS: Record<string, number> = {
  'free-rewards': 2,
  'stability-reload': 2,
}

export function readFixture<T>(domain: string): T[] {
  const fixture = JSON.parse(
    readFileSync(new URL(`./fixtures/${domain}.cases.json`, import.meta.url), 'utf8'),
  ) as Fixture<T>
  const expectedVersion = FIXTURE_VERSIONS[domain] ?? 1
  if (fixture.domain !== domain || fixture.version !== expectedVersion) {
    throw new Error(`Unsupported parity fixture: ${domain}`)
  }
  return fixture.cases
}

export function forEachCase(domain: 'bucket-attribution'): BucketAttributionCase[] {
  return readFixture<BucketAttributionCase>(domain)
}

export function forEachGoalPacingCase(): GoalPacingCase[] {
  return readFixture<GoalPacingCase>('goal-pacing')
}

export function forEachFreeRewardsCase(): FreeRewardsCase[] {
  return readFixture<FreeRewardsCase>('free-rewards')
}
