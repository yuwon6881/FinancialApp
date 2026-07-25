import type {
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentTransactionType,
} from '../types'

/**
 * Client-side mirror of the backend's investment guards
 * (`InvestmentsController.ValidateCashHistoryAsync` and
 * `InvestmentAccountingService.RequireAvailableUnits`): a record may never push an
 * account's cash balance below zero, and units can only be sold or transferred out
 * if they are actually held. The server stays the source of truth; these checks
 * exist so the user is told before the record is queued, not after it is rejected.
 */

/** Decimal noise from derived values (gross = units x price) must not trip a check. */
const tolerance = 1e-9

export interface ActivityBalanceDraft {
  type: InvestmentTransactionType
  accountId: string
  instrumentId: string
  units?: number
  cashAmount?: number
  fees?: number
  taxes?: number
}

export interface CashFlowBalanceDraft {
  accountId: string
  type: InvestmentCashFlow['type']
  currency: string
  /** Always positive: the sign is derived from the movement type. */
  amount?: number
  toCurrency?: string
  toAmount?: number
}

export interface BalanceIssue {
  /** Form field the message belongs to, so it can be shown next to the offending input. */
  field: 'units' | 'cashAmount' | 'amount' | 'toAmount' | 'toCurrency' | 'form'
  message: string
}

const same = (left: string | undefined, right: string | undefined) =>
  (left ?? '').toUpperCase() === (right ?? '').toUpperCase()

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const units = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value)

/** Cash an account currently holds in one currency, as reported by the portfolio. */
export const availableCash = (portfolio: InvestmentPortfolio | null, accountId: string, currency: string) =>
  (portfolio?.cashBalances ?? [])
    .filter(balance => balance.accountId === accountId && same(balance.currency, currency))
    .reduce((total, balance) => total + balance.amount, 0)

/** Units of one instrument currently held in one account. */
export const availableUnits = (portfolio: InvestmentPortfolio | null, accountId: string, instrumentId: string) =>
  (portfolio?.holdings ?? [])
    .filter(holding => holding.accountId === accountId && holding.instrumentId === instrumentId)
    .reduce((total, holding) => total + holding.units, 0)

/**
 * Signed effect of an activity on the cash of its account, in the instrument's
 * currency. Mirrors the `switch` in `ValidateCashHistoryAsync`.
 */
const activityCashEffect = (draft: ActivityBalanceDraft) => {
  const gross = draft.cashAmount ?? 0
  const charges = (draft.fees ?? 0) + (draft.taxes ?? 0)
  switch (draft.type) {
    case 'Buy':
    case 'FeeTax':
      return -(gross + charges)
    case 'Sell':
    case 'Dividend':
      return gross - charges
    default:
      return 0
  }
}

/** Signed effect of an activity on the units held. */
const activityUnitsEffect = (draft: ActivityBalanceDraft) => {
  switch (draft.type) {
    case 'OpeningPosition':
    case 'Buy':
    case 'TransferIn':
      return draft.units ?? 0
    case 'Sell':
    case 'TransferOut':
      return -(draft.units ?? 0)
    default:
      return 0
  }
}

/**
 * Checks a new or edited activity against the account's cash and units. `initial`
 * is the record being replaced, whose own effect is added back so an edit is
 * measured against the balance without it.
 */
export function validateActivityBalances(
  portfolio: InvestmentPortfolio | null,
  draft: ActivityBalanceDraft,
  initial?: InvestmentActivity | null,
): BalanceIssue | null {
  if (!portfolio) return null
  const account = portfolio.accounts.find(value => value.id === draft.accountId)
  const instrument = portfolio.instruments.find(value => value.id === draft.instrumentId)
  if (!account || !instrument) return null

  const replaced = initial && initial.accountId === draft.accountId ? initial : null
  const sameInstrument = replaced && replaced.instrumentId === draft.instrumentId ? replaced : null

  const needed = -activityCashEffect(draft)
  if (needed > tolerance) {
    const heldCash = availableCash(portfolio, draft.accountId, instrument.currency) -
      (sameInstrument ? activityCashEffect(sameInstrument) : 0)
    if (needed > heldCash + tolerance) {
      return {
        field: 'cashAmount',
        message: `Only ${money(Math.max(heldCash, 0), instrument.currency)} is available in ${account.name}. ` +
          `This needs ${money(needed, instrument.currency)} — deposit or convert cash first, ` +
          'or sell a holding to raise it.',
      }
    }
  }

  const removed = -activityUnitsEffect(draft)
  if (removed > tolerance) {
    const heldUnits = availableUnits(portfolio, draft.accountId, draft.instrumentId) -
      (sameInstrument ? activityUnitsEffect(sameInstrument) : 0)
    if (removed > heldUnits + tolerance) {
      return {
        field: 'units',
        message: `Only ${units(Math.max(heldUnits, 0))} units of ${instrument.symbol} are held in ${account.name}.`,
      }
    }
  }

  if (draft.type === 'Dividend' && activityCashEffect(draft) < -tolerance) {
    return { field: 'cashAmount', message: 'Dividend cash cannot be less than its fees and taxes.' }
  }

  return null
}

/** Signed effect of a cash movement on each currency bucket of its account. */
const cashFlowEffects = (draft: CashFlowBalanceDraft): Array<{ currency: string; amount: number }> => {
  const amount = Math.abs(draft.amount ?? 0)
  if (draft.type === 'Deposit') return [{ currency: draft.currency, amount }]
  if (draft.type === 'Withdrawal') return [{ currency: draft.currency, amount: -amount }]
  return [
    { currency: draft.currency, amount: -amount },
    { currency: draft.toCurrency ?? draft.currency, amount: Math.abs(draft.toAmount ?? 0) },
  ]
}

/** Existing records store the debited leg as a negative amount already. */
const storedCashFlowEffects = (flow: InvestmentCashFlow) => cashFlowEffects({
  accountId: flow.accountId,
  type: flow.type,
  currency: flow.currency,
  amount: flow.amount,
  toCurrency: flow.toCurrency,
  toAmount: flow.toAmount,
})

/**
 * Checks a withdrawal or conversion against the cash actually sitting in the
 * account. Deposits always pass.
 */
export function validateCashFlowBalances(
  portfolio: InvestmentPortfolio | null,
  draft: CashFlowBalanceDraft,
  initial?: InvestmentCashFlow | null,
): BalanceIssue | null {
  if (!portfolio) return null
  const account = portfolio.accounts.find(value => value.id === draft.accountId)
  if (!account) return null
  if (draft.type === 'Conversion' && same(draft.currency, draft.toCurrency)) {
    return { field: 'toCurrency', message: 'A conversion must use two different currencies.' }
  }
  if (draft.type === 'Deposit') return null

  const replaced = initial && initial.accountId === draft.accountId ? initial : null
  const restored = replaced ? storedCashFlowEffects(replaced) : []
  const spent = -cashFlowEffects(draft)
    .filter(effect => same(effect.currency, draft.currency))
    .reduce((total, effect) => total + effect.amount, 0)
  if (spent <= tolerance) return null

  const held = availableCash(portfolio, draft.accountId, draft.currency) -
    restored.filter(effect => same(effect.currency, draft.currency))
      .reduce((total, effect) => total + effect.amount, 0)
  if (spent <= held + tolerance) return null

  const currency = draft.currency.toUpperCase()
  return {
    field: 'amount',
    message: draft.type === 'Withdrawal'
      ? `Only ${money(Math.max(held, 0), currency)} of ${currency} cash is available in ${account.name}. ` +
        'Sell a holding, or convert cash into this currency, before withdrawing.'
      : `Only ${money(Math.max(held, 0), currency)} of ${currency} cash is available in ${account.name} to convert.`,
  }
}
