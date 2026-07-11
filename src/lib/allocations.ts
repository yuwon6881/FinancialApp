// Allocation auto-balance algorithm extracted from SettingsView.
//
// The four budget buckets (essentials / growth / stability / rewards) must always
// sum to 100. When the user drags one slider, the delta is absorbed by the other
// (unlocked) buckets in 5-point steps, rotating through them so no single bucket
// takes the whole hit. Locked buckets never change. Kept pure so the rounding /
// rotation / clamping behaviour is directly testable.

export type AllocationKey = 'essentials' | 'growth' | 'stability' | 'rewards'

export type Allocation = Record<AllocationKey, number>

const ALL_KEYS: readonly AllocationKey[] = ['essentials', 'growth', 'stability', 'rewards']

/**
 * Given the current allocation and a change to one bucket, return the rebalanced
 * allocation (always summing to 100). Returns `null` when the change is a no-op
 * or cannot be applied: the changed key is locked, there are no other unlocked
 * keys to absorb the delta, or the rounded value equals the current one.
 *
 * `newValue` is clamped to [0, 100] and snapped to the nearest multiple of 5.
 */
export function rebalanceAllocations(
  current: Allocation,
  changedKey: AllocationKey,
  newValue: number,
  lockedAllocations: AllocationKey[]
): Allocation | null {
  if (lockedAllocations.includes(changedKey)) return null

  newValue = Math.round(Math.max(0, Math.min(100, newValue)) / 5) * 5
  const diff = newValue - current[changedKey]
  if (diff === 0) return null

  const otherKeys = ALL_KEYS.filter(k => k !== changedKey && !lockedAllocations.includes(k))
  if (otherKeys.length === 0) return null

  const newAlloc: Allocation = { ...current, [changedKey]: newValue }

  let remainingDiff = Math.round(diff)
  let startIdx = 0
  while (remainingDiff !== 0) {
    let adjusted = false
    const step = Math.min(5, Math.abs(remainingDiff))
    const sign = Math.sign(remainingDiff)

    for (let i = 0; i < otherKeys.length; i++) {
      const k = otherKeys[(startIdx + i) % otherKeys.length]
      if (sign > 0 && newAlloc[k] >= step) {
        newAlloc[k] -= step
        remainingDiff -= step
        adjusted = true
        startIdx = (startIdx + i + 1) % otherKeys.length
        break
      } else if (sign < 0 && newAlloc[k] <= 100 - step) {
        newAlloc[k] += step
        remainingDiff += step
        adjusted = true
        startIdx = (startIdx + i + 1) % otherKeys.length
        break
      }
    }
    if (!adjusted) {
      newAlloc[changedKey] -= remainingDiff
      break
    }
  }

  return newAlloc
}
