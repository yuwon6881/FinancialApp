// Withdrawal planning — the mirror of the deposit guide's cash-flow rebalancing
// (`BuildContributionPlan` in InvestmentAllocationService).
//
// Deliberately client-side and pure: every input is already loaded with the
// portfolio, so planning a withdrawal costs no request and no market-data quota,
// and the answer can update while the user is still typing an amount.

/** Values are all in the app currency. */
export interface WithdrawalSleeveInput {
  sleeve: string
  label: string
  targetPercentage: number
  value: number
  /** On-paper gain/loss for the whole basket. `undefined` when any holding is unpriced. */
  unrealisedProfitLoss?: number
}

export interface WithdrawalSleevePlan {
  sleeve: string
  label: string
  /** How much of this basket to sell. */
  amount: number
  /** This basket's share of the money raised by selling. */
  percentageOfSale: number
  /** Share of the basket's own value being sold. */
  percentageOfBasket: number
  projectedValue: number
  projectedPercentage: number
  projectedDriftPercentagePoints: number
  /**
   * On-paper gain/loss this sale is expected to turn into a real one, pro-rated by the
   * fraction of the basket sold. An estimate, not a tax figure: a real broker realises
   * whichever specific lots are sold, which this cannot know.
   */
  estimatedRealisedProfitLoss?: number
}

export interface WithdrawalPlan {
  requested: number
  /** Taken from uninvested broker cash, so no selling is involved. */
  fromCash: number
  /** Raised by selling holdings. */
  fromHoldings: number
  /** Requested beyond what cash and holdings together can cover. */
  shortfall: number
  sleeves: WithdrawalSleevePlan[]
  /** Portfolio value once the sale settles. */
  projectedTotal: number
  /** Largest absolute distance from target the withdrawal leaves behind. */
  worstProjectedDrift: number
  estimatedRealisedProfitLoss?: number
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Works out where a withdrawal should come from.
 *
 * The rule is the target mix, not gains or losses: money is taken from whichever baskets
 * are *above* their target share of what will be left, so the withdrawal doubles as a
 * rebalance. Selling by profit or loss instead would be a tax strategy this app cannot
 * model honestly (it holds no per-lot cost basis and no jurisdiction rules) and would
 * routinely push the mix further off target — the one thing the plan exists to control.
 * Expected gain/loss is reported per basket so the decision is visible, never so it drives
 * the split.
 *
 * Uninvested broker cash is spent first, exactly as the deposit guide invests it first.
 */
export function planWithdrawal(
  requestedAmount: number,
  availableCash: number,
  sleeves: WithdrawalSleeveInput[],
): WithdrawalPlan | null {
  const requested = round(Math.max(0, requestedAmount))
  if (requested <= 0) return null

  const invested = sleeves.reduce((sum, sleeve) => sum + Math.max(0, sleeve.value), 0)
  const cash = Math.max(0, availableCash)

  const fromCash = Math.min(requested, cash)
  const fromHoldings = Math.min(requested - fromCash, invested)
  const shortfall = round(requested - fromCash - fromHoldings)
  const projectedTotal = invested - fromHoldings

  // Each basket's excess over the share it should hold of what remains *after* the
  // withdrawal. These surpluses always sum to at least the amount being raised, so
  // taking from them proportionally never asks a basket for more than it holds.
  const surpluses = sleeves.map(sleeve =>
    Math.max(0, sleeve.value - projectedTotal * sleeve.targetPercentage / 100))
  const totalSurplus = surpluses.reduce((sum, value) => sum + value, 0)

  const raw = sleeves.map((sleeve, index) => {
    if (fromHoldings <= 0) return 0
    // Only reachable through rounding: with no surplus anywhere, fall back to the plain
    // target split so the sale is still spread the way the plan intends.
    if (totalSurplus <= 0.005) return fromHoldings * sleeve.targetPercentage / 100
    return fromHoldings * surpluses[index] / totalSurplus
  })

  // Rounding to cents must not invent or lose money: the largest sale absorbs the
  // difference so the parts add back up to the amount the user asked to withdraw.
  const amounts = raw.map(round)
  const drift = round(fromHoldings) - amounts.reduce((sum, value) => sum + value, 0)
  if (drift !== 0 && amounts.length > 0) {
    const largest = amounts.reduce(
      (best, value, index) => (value > amounts[best] ? index : best), 0)
    amounts[largest] = round(amounts[largest] + drift)
  }

  const planned = sleeves.map<WithdrawalSleevePlan>((sleeve, index) => {
    const amount = amounts[index]
    const projectedValue = sleeve.value - amount
    const projectedPercentage = projectedTotal <= 0 ? 0 : projectedValue / projectedTotal * 100
    const shareSold = sleeve.value <= 0 ? 0 : amount / sleeve.value
    return {
      sleeve: sleeve.sleeve,
      label: sleeve.label,
      amount,
      percentageOfSale: fromHoldings <= 0 ? 0 : Math.round(amount / fromHoldings * 1000) / 10,
      percentageOfBasket: Math.round(shareSold * 1000) / 10,
      projectedValue: round(projectedValue),
      projectedPercentage: Math.round(projectedPercentage * 100) / 100,
      projectedDriftPercentagePoints: Math.round((projectedPercentage - sleeve.targetPercentage) * 100) / 100,
      estimatedRealisedProfitLoss: sleeve.unrealisedProfitLoss === undefined
        ? undefined
        : round(sleeve.unrealisedProfitLoss * shareSold),
    }
  })

  // One unknown basket makes the total unknown; reporting the rest as if it were the
  // whole figure would understate a gain or a loss the user is about to take.
  const anyUnknown = planned.some(sleeve => sleeve.estimatedRealisedProfitLoss === undefined)

  return {
    requested,
    fromCash: round(fromCash),
    fromHoldings: round(fromHoldings),
    shortfall: shortfall > 0.005 ? shortfall : 0,
    sleeves: planned,
    projectedTotal: round(projectedTotal),
    worstProjectedDrift: planned.reduce(
      (worst, sleeve) => Math.max(worst, Math.abs(sleeve.projectedDriftPercentagePoints)), 0),
    estimatedRealisedProfitLoss: anyUnknown
      ? undefined
      : round(planned.reduce((sum, sleeve) => sum + (sleeve.estimatedRealisedProfitLoss ?? 0), 0)),
  }
}
