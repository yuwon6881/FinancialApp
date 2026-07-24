import type { InvestmentPlan } from '../types'

type TargetKey = 'usEquityTarget' | 'internationalExUsTarget' | 'bondsTarget'

export function redistributeInvestmentTargets(
  current: Pick<InvestmentPlan, TargetKey>,
  changed: TargetKey,
  requested: number,
  lockedKey?: TargetKey,
): Pick<InvestmentPlan, TargetKey> {
  const keys: TargetKey[] = ['usEquityTarget', 'internationalExUsTarget', 'bondsTarget']
  const value = Math.max(1, Math.min(lockedKey ? 99 - current[lockedKey] : 98, Math.round(requested)))
  const others = keys.filter(key => key !== changed)
  const remainder = 100 - value
  
  if (lockedKey && lockedKey !== changed) {
    const unlockedOther = others.find(key => key !== lockedKey)!
    const lockedValue = current[lockedKey]
    const remainingForUnlocked = Math.max(1, remainder - lockedValue)
    const finalLockedValue = Math.max(1, remainder - remainingForUnlocked)
    return {
      ...current,
      [changed]: value,
      [lockedKey]: finalLockedValue,
      [unlockedOther]: remainingForUnlocked,
    }
  }

  const otherTotal = current[others[0]] + current[others[1]]
  const first = Math.max(1, Math.min(remainder - 1,
    Math.round(remainder * (otherTotal > 0 ? current[others[0]] / otherTotal : 0.5))))
  return {
    ...current,
    [changed]: value,
    [others[0]]: first,
    [others[1]]: remainder - first,
  }
}
