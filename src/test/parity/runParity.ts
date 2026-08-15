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
      status: 'Pending' | 'Paid'
      ledgerCategory: string
      category: string
      scheduledAmount: number
    }>
  }
  expected: { pendingRewards: number; unassigned: number }
}

type Fixture<T> = {
  domain: string
  version: number
  cases: T[]
}

export function readFixture<T>(domain: string): T[] {
  const fixture = JSON.parse(
    readFileSync(new URL(`./fixtures/${domain}.cases.json`, import.meta.url), 'utf8'),
  ) as Fixture<T>
  if (fixture.domain !== domain || fixture.version !== 1) {
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
