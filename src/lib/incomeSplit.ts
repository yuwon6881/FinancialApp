// Income allocation math extracted from LedgerView's transaction submit handler.
//
// When income lands and the stability fund is (or would become) capped, the
// portion that would have gone to stability is redirected to other buckets and
// the whole split is encoded into the transaction's `ledgerCategory` as
// `IncomeSplit:<ess>,<gro>,<sta>,<rew>` where each value is a percentage with
// four decimal places. Kept as a pure function so the (previously untested)
// cap/overflow-redirect logic can be exercised directly.

export type StabilityOverflowRedirect =
  | 'Growth 100%'
  | 'Rewards 100%'
  | 'Essentials 100%'
  | string // any other value => default split across Growth + Rewards

export interface IncomeSplitInput {
  /** Signed transaction amount (income is positive). */
  amount: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  stabilityBalance: number
  stabilityTarget: number
  stabilityOverflowRedirect: StabilityOverflowRedirect
}

/** Which buckets absorb the redirected stability share, per the setting. */
export function resolveRedirectTargets(redirect: StabilityOverflowRedirect): string[] {
  if (redirect === 'Growth 100%') return ['Growth']
  if (redirect === 'Rewards 100%') return ['Rewards']
  if (redirect === 'Essentials 100%') return ['Essentials']
  return ['Growth', 'Rewards']
}

/**
 * Compute the `ledgerCategory` for an income transaction.
 *
 * Returns `'Income'` when no redirection applies (the stability fund is neither
 * already capped nor pushed over the cap by this deposit). Otherwise returns the
 * encoded `IncomeSplit:...` string with the redirected shares folded in.
 */
export function computeIncomeLedgerCategory(input: IncomeSplitInput): string {
  const {
    amount,
    essentialsAlloc,
    growthAlloc,
    stabilityAlloc,
    rewardsAlloc,
    stabilityBalance,
    stabilityTarget,
    stabilityOverflowRedirect,
  } = input

  const isCapReached = stabilityBalance >= stabilityTarget
  const defaultStabilityContribution = amount * stabilityAlloc
  const isCapReachedMidDeposit = !isCapReached && (stabilityBalance + defaultStabilityContribution > stabilityTarget)

  if (!isCapReached && !isCapReachedMidDeposit) {
    return 'Income'
  }

  const redirectTargets = resolveRedirectTargets(stabilityOverflowRedirect)

  let ess = essentialsAlloc
  let gro = growthAlloc
  let rew = rewardsAlloc

  let actualStabilityShare = 0
  if (!isCapReached) {
    const stabilityNeeded = Math.max(0, stabilityTarget - stabilityBalance)
    if (defaultStabilityContribution > stabilityNeeded) {
      actualStabilityShare = stabilityNeeded / amount
    } else {
      actualStabilityShare = stabilityAlloc
    }
  }

  const redirectShare = stabilityAlloc - actualStabilityShare
  const sta = actualStabilityShare

  if (redirectShare > 0 && redirectTargets.length > 0) {
    const N = redirectTargets.length
    const baseSharePerTarget = Math.floor((redirectShare / N) * 10000) / 10000
    const sumOfShares = baseSharePerTarget * N
    const remainder = redirectShare - sumOfShares

    redirectTargets.forEach((target, index) => {
      let addedShare = baseSharePerTarget
      if (index === 0) addedShare += remainder

      if (target === 'Essentials') ess += addedShare
      if (target === 'Growth') gro += addedShare
      if (target === 'Rewards') rew += addedShare
    })
  }

  const essR = Math.round(ess * 10000) / 10000
  const groR = Math.round(gro * 10000) / 10000
  const staR = Math.round(sta * 10000) / 10000
  const rewR = Math.round(rew * 10000) / 10000

  return `IncomeSplit:${(essR * 100).toFixed(4)},${(groR * 100).toFixed(4)},${(staR * 100).toFixed(4)},${(rewR * 100).toFixed(4)}`
}
