import type { InvestmentActivity } from '../types'

export function investmentActivityCharges(activity: InvestmentActivity) {
  const fees = Math.max(0, activity.fees)
  const taxes = Math.max(0, activity.taxes)
  return {
    fees,
    taxes,
    total: Math.round((fees + taxes) * 100) / 100,
  }
}

/**
 * The form records the trade/dividend amount before charges. The account cash effect is the
 * amount after fees and taxes, with buys and charges leaving cash and sells/dividends adding it.
 */
export function investmentActivityCashAfterCharges(activity: InvestmentActivity): number | undefined {
  const charges = investmentActivityCharges(activity)
  if (charges.total <= 0 || activity.cashAmount === undefined) return undefined

  const gross = activity.cashAmount
  return activity.type === 'Sell' || activity.type === 'Dividend'
    ? gross - charges.total
    : -(gross + charges.total)
}
