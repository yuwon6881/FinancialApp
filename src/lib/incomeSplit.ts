// Income allocation math extracted from LedgerView's transaction submit handler.
//
// When income lands and the stability fund is (or would become) capped, the
// portion that would have gone to stability is redirected to other buckets and
// the whole split is encoded into the transaction's `ledgerCategory` as
// `IncomeSplit:<ess>,<gro>,<sta>,<rew>` where each value is a percentage with
// four decimal places. Kept as a pure function so the (previously untested)
// cap/overflow-redirect logic can be exercised directly.
//
// The same encoding carries an accepted emergency-fund top-up: that is not a new
// kind of fact, just "this salary was split differently", which is exactly what
// the prefix already means. Mirrors `Services/Stability/IncomeSplitPlanner.cs`,
// which re-derives the split authoritatively on save.

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
  /**
   * Absolute amount to add to stability on top of its usual share, already capped by
   * `proposeTopUp`. Omitted or zero leaves the encoding byte-identical to the plain case.
   */
  recoveryTopUp?: number
}

const REDIRECTABLE = ['Essentials', 'Growth', 'Rewards']

/**
 * Which buckets absorb the redirected stability share, and in what proportion.
 *
 * Parses both shapes the setting uses — `Growth 100%` and `Split: Essentials 50%, Growth 50%` —
 * rather than matching whole strings. Matching only the three `X 100%` values sent every
 * `Split: …` option to Growth+Rewards, so two of the six settings options silently ignored
 * Essentials despite being labelled for it.
 */
export function resolveRedirectWeights(
  redirect: StabilityOverflowRedirect
): { bucket: string; weight: number }[] {
  const fallback = [
    { bucket: 'Growth', weight: 0.5 },
    { bucket: 'Rewards', weight: 0.5 },
  ]
  if (!redirect) return fallback

  const body = redirect.trim().replace(/^Split:/i, '')
  const parsed: { bucket: string; weight: number }[] = []
  for (const token of body.split(',')) {
    const match = token.trim().match(/^(.+?)\s+([\d.]+)\s*%?$/)
    if (!match) continue
    const bucket = REDIRECTABLE.find(name => name.toLowerCase() === match[1].trim().toLowerCase())
    const weight = Number(match[2])
    if (!bucket || !Number.isFinite(weight) || weight <= 0) continue
    parsed.push({ bucket, weight })
  }

  if (parsed.length === 0) return fallback
  const total = parsed.reduce((sum, entry) => sum + entry.weight, 0)
  return parsed.map(entry => ({ bucket: entry.bucket, weight: entry.weight / total }))
}

/** Which buckets absorb the redirected stability share, per the setting. */
export function resolveRedirectTargets(redirect: StabilityOverflowRedirect): string[] {
  return resolveRedirectWeights(redirect).map(entry => entry.bucket)
}

/**
 * Compute the `ledgerCategory` for an income transaction.
 *
 * Returns `'Income'` when nothing needs encoding (the stability fund is neither
 * already capped nor pushed over the cap by this deposit, and no top-up was
 * accepted). Otherwise returns the encoded `IncomeSplit:...` string.
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
    recoveryTopUp = 0,
  } = input

  // A target of zero means the user has chosen not to cap Stability. It is not a zero-sized fund
  // that should redirect every normal income split; the server applies the same no-target rule.
  const hasStabilityTarget = stabilityTarget > 0
  const isCapReached = hasStabilityTarget && stabilityBalance >= stabilityTarget
  const defaultStabilityContribution = amount * stabilityAlloc
  const isCapReachedMidDeposit = hasStabilityTarget && !isCapReached && (stabilityBalance + defaultStabilityContribution > stabilityTarget)

  if (!isCapReached && !isCapReachedMidDeposit && recoveryTopUp <= 0) {
    return 'Income'
  }

  // The top-up comes out of the other three in proportion, matching the server's composition
  // order: baseline, then top-up, then cap, then redirect.
  let ess = essentialsAlloc
  let gro = growthAlloc
  let rew = rewardsAlloc
  let requestedStabilityShare = stabilityAlloc

  const others = essentialsAlloc + growthAlloc + rewardsAlloc
  if (recoveryTopUp > 0 && amount > 0 && others > 0) {
    const topUpShare = Math.min(recoveryTopUp / amount, others)
    const drawn = topUpShare / others
    ess *= 1 - drawn
    gro *= 1 - drawn
    rew *= 1 - drawn
    requestedStabilityShare += topUpShare
  }

  const redirectTargets = resolveRedirectWeights(stabilityOverflowRedirect)

  let actualStabilityShare = hasStabilityTarget ? 0 : requestedStabilityShare
  if (hasStabilityTarget && !isCapReached && amount > 0) {
    const stabilityNeeded = Math.max(0, stabilityTarget - stabilityBalance)
    const requestedContribution = amount * requestedStabilityShare
    actualStabilityShare = requestedContribution > stabilityNeeded
      ? stabilityNeeded / amount
      : requestedStabilityShare
  }

  const redirectShare = requestedStabilityShare - actualStabilityShare
  const sta = actualStabilityShare

  if (redirectShare > 0 && redirectTargets.length > 0) {
    for (const target of redirectTargets) {
      const addedShare = redirectShare * target.weight
      if (target.bucket === 'Essentials') ess += addedShare
      if (target.bucket === 'Growth') gro += addedShare
      if (target.bucket === 'Rewards') rew += addedShare
    }
  }

  // Rounded to 4dp — the wire precision — then the drift pushed onto the largest share, so the
  // four percentages always sum to exactly 100 and no cent is invented or lost.
  const shares = [ess, gro, sta, rew].map(share => Math.round(Math.max(0, share) * 10000) / 10000)
  let largest = 0
  for (let i = 1; i < shares.length; i += 1) {
    if (shares[i] > shares[largest]) largest = i
  }
  shares[largest] += 1 - shares.reduce((sum, share) => sum + share, 0)

  return `IncomeSplit:${shares.map(share => (share * 100).toFixed(4)).join(',')}`
}
