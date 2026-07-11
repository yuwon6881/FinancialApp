import { describe, expect, it } from 'vitest'
import { rebalanceAllocations, type Allocation } from './allocations'

const even: Allocation = { essentials: 25, growth: 25, stability: 25, rewards: 25 }

describe('rebalanceAllocations', () => {
  it('spreads an increase across the other buckets in rotation, staying at 100', () => {
    const result = rebalanceAllocations(even, 'essentials', 40, [])
    expect(result).toEqual({ essentials: 40, growth: 20, stability: 20, rewards: 20 })
    expect(sum(result!)).toBe(100)
  })

  it('spreads a decrease across the other buckets, staying at 100', () => {
    const result = rebalanceAllocations(even, 'essentials', 10, [])
    expect(result).toEqual({ essentials: 10, growth: 30, stability: 30, rewards: 30 })
    expect(sum(result!)).toBe(100)
  })

  it('never touches locked buckets', () => {
    const result = rebalanceAllocations(even, 'essentials', 40, ['growth'])
    expect(result!.growth).toBe(25)
    expect(result).toEqual({ essentials: 40, growth: 25, stability: 15, rewards: 20 })
    expect(sum(result!)).toBe(100)
  })

  it('snaps the new value to the nearest multiple of 5', () => {
    // 43 -> 45
    const result = rebalanceAllocations(even, 'essentials', 43, [])
    expect(result!.essentials).toBe(45)
    expect(sum(result!)).toBe(100)
  })

  it('clamps the new value into [0, 100]', () => {
    expect(rebalanceAllocations(even, 'essentials', 250, [])!.essentials).toBe(100)
    expect(rebalanceAllocations(even, 'essentials', -50, [])!.essentials).toBe(0)
  })

  it('returns null when the changed bucket is locked', () => {
    expect(rebalanceAllocations(even, 'essentials', 40, ['essentials'])).toBeNull()
  })

  it('returns null when the snapped value equals the current value (no-op)', () => {
    // 27 -> 25, which is unchanged.
    expect(rebalanceAllocations(even, 'essentials', 27, [])).toBeNull()
  })

  it('returns null when every other bucket is locked', () => {
    expect(rebalanceAllocations(even, 'essentials', 40, ['growth', 'stability', 'rewards'])).toBeNull()
  })

  it('does not mutate the input allocation', () => {
    const input = { ...even }
    rebalanceAllocations(input, 'essentials', 40, [])
    expect(input).toEqual(even)
  })
})

function sum(a: Allocation): number {
  return a.essentials + a.growth + a.stability + a.rewards
}
