// Deposit planning — the mirror of the withdrawal guide's cash-flow rebalancing
// (`BuildContributionPlan` in InvestmentAllocationService).
//
// Deliberately client-side and pure: every input is already loaded with the
// portfolio, so planning a deposit costs no request and no market-data quota,
// and the answer can update while the user is still typing an amount.

/** Values are all in the app currency. */
export interface DepositSleeveInput {
  sleeve: string
  label: string
  targetPercentage: number
  /** Current market value of this basket. `undefined` or missing = treated as 0. */
  value?: number
}

export interface DepositSleevePlan {
  sleeve: string
  label: string
  /** How much of this deposit goes into this basket. */
  amount: number
  /** This basket's share of the total deposit amount. */
  percentageOfDeposit: number
  projectedValue: number
  projectedPercentage: number
  projectedDriftPercentagePoints: number
}

export interface DepositPlan {
  requested: number
  sleeves: DepositSleevePlan[]
  /** Portfolio value once the deposit is fully invested. */
  projectedTotal: number
  /** Largest absolute distance from target the deposit leaves behind. */
  worstProjectedDrift: number
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Works out where a deposit should go.
 *
 * The rule is the target mix, not current prices: money goes into whichever
 * baskets are *below* their target share of what will be held once invested,
 * so the deposit doubles as a rebalance without selling anything.
 *
 * This is the mirror of `planWithdrawal`: surpluses drive a withdrawal split;
 * deficits drive a deposit split.
 */
export function planDeposit(
  requestedAmount: number,
  sleeves: DepositSleeveInput[],
): DepositPlan | null {
  const requested = round(Math.max(0, requestedAmount))
  if (requested <= 0) return null

  const invested = sleeves.reduce((sum, sleeve) => sum + Math.max(0, sleeve.value ?? 0), 0)
  const projectedTotal = invested + requested

  // Each basket's shortfall relative to its target share of the post-deposit
  // total. Deficits always sum to at least the deposit amount being placed, so
  // taking from them proportionally never puts more than needed into any basket.
  const deficits = sleeves.map(sleeve =>
    Math.max(0, projectedTotal * sleeve.targetPercentage / 100 - Math.max(0, sleeve.value ?? 0)))
  const totalDeficit = deficits.reduce((sum, value) => sum + value, 0)

  const raw = sleeves.map((sleeve, index) => {
    // Only reachable through rounding: with no deficit anywhere (all overweight),
    // fall back to the plain target split so the deposit is still spread the way
    // the plan intends — mirrors planWithdrawal's totalSurplus <= 0.005 fallback.
    if (totalDeficit <= 0.005) return requested * sleeve.targetPercentage / 100
    return requested * deficits[index] / totalDeficit
  })

  // Rounding to cents must not invent or lose money: the largest allocation
  // absorbs the difference so the parts add back up to the requested amount.
  const amounts = raw.map(round)
  const drift = round(requested) - amounts.reduce((sum, value) => sum + value, 0)
  if (drift !== 0 && amounts.length > 0) {
    const largest = amounts.reduce(
      (best, value, index) => (value > amounts[best] ? index : best), 0)
    amounts[largest] = round(amounts[largest] + drift)
  }

  const planned = sleeves.map<DepositSleevePlan>((sleeve, index) => {
    const amount = amounts[index]
    const projectedValue = Math.max(0, sleeve.value ?? 0) + amount
    const projectedPercentage = projectedTotal <= 0 ? 0 : projectedValue / projectedTotal * 100
    return {
      sleeve: sleeve.sleeve,
      label: sleeve.label,
      amount,
      percentageOfDeposit: requested <= 0 ? 0 : Math.round(amount / requested * 1000) / 10,
      projectedValue: round(projectedValue),
      projectedPercentage: Math.round(projectedPercentage * 100) / 100,
      projectedDriftPercentagePoints: Math.round((projectedPercentage - sleeve.targetPercentage) * 100) / 100,
    }
  })

  return {
    requested,
    sleeves: planned,
    projectedTotal: round(projectedTotal),
    worstProjectedDrift: planned.reduce(
      (worst, sleeve) => Math.max(worst, Math.abs(sleeve.projectedDriftPercentagePoints)), 0),
  }
}
