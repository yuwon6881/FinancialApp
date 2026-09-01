import type {
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentTransactionType,
} from '../types'

/**
 * Client-side mirror of the backend's investment guards
 * (`InvestmentHistoryValidationService` and
 * `InvestmentAccountingService.RequireAvailableUnits`): explicit cash movements
 * cannot spend unavailable cash, and units can only be sold if they are held.
 * Broker executions may temporarily overdraw a currency until settlement funding
 * is recorded. The server stays the source of truth; these checks provide early
 * feedback before a record is queued.
 */

/** Decimal noise from derived values (gross = units x price) must not trip a check. */
const tolerance = 1e-9

export interface ActivityBalanceDraft {
  type: InvestmentTransactionType
  accountId: string
  instrumentId: string
  units?: number
  unitPrice?: number
  cashAmount?: number
  fees?: number
  taxes?: number
}

/**
 * A locally queued row plus the server row it replaces, when the queue entry is
 * an edit. The original is needed because the portfolio cash/units already
 * include the server row.
 */
export interface PendingInvestmentActivity extends InvestmentActivity {
  pendingOriginal?: InvestmentActivity | null
}

export interface PendingInvestmentCashFlow extends InvestmentCashFlow {
  pendingOriginal?: InvestmentCashFlow | null
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
  const gross = draft.cashAmount ?? (draft.units ?? 0) * (draft.unitPrice ?? 0)
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
    case 'Buy':
      return draft.units ?? 0
    case 'Sell':
      return -(draft.units ?? 0)
    default:
      return 0
  }
}

const activityCashEffectFor = (
  portfolio: InvestmentPortfolio | null,
  activity: InvestmentActivity | null | undefined,
  accountId: string,
  currency: string,
) => {
  if (!activity || activity.accountId !== accountId) return 0
  const instrument = portfolio?.instruments.find(value => value.id === activity.instrumentId)
  return instrument && same(instrument.currency, currency) ? activityCashEffect(activity) : 0
}

const activityUnitsEffectFor = (
  activity: InvestmentActivity | null | undefined,
  accountId: string,
  instrumentId: string,
) => activity && activity.accountId === accountId && activity.instrumentId === instrumentId
  ? activityUnitsEffect(activity)
  : 0

const originalActivity = (
  pendingActivities: PendingInvestmentActivity[],
  initial?: InvestmentActivity | null,
) => {
  const queuedReplacement = pendingActivities.find(activity => activity.id === initial?.id)
  return queuedReplacement
    ? queuedReplacement.pendingOriginal ?? null
    : initial?.isPendingSync ? null : initial ?? null
}

/** Cash and units after applying the net changes from locally queued activity. */
export const availableActivityCash = (
  portfolio: InvestmentPortfolio | null,
  accountId: string,
  currency: string,
  pendingActivities: PendingInvestmentActivity[] = [],
  initial?: InvestmentActivity | null,
) => {
  const replacement = originalActivity(pendingActivities, initial)
  const pending = pendingActivities.filter(activity => activity.id !== initial?.id)
  return availableCash(portfolio, accountId, currency) + pending.reduce((total, activity) => total +
    activityCashEffectFor(portfolio, activity, accountId, currency) -
    activityCashEffectFor(portfolio, activity.pendingOriginal ?? undefined, accountId, currency), 0) -
    (replacement ? activityCashEffectFor(portfolio, replacement, accountId, currency) : 0)
}

export const availableActivityUnits = (
  portfolio: InvestmentPortfolio | null,
  accountId: string,
  instrumentId: string,
  pendingActivities: PendingInvestmentActivity[] = [],
  initial?: InvestmentActivity | null,
) => {
  const replacement = originalActivity(pendingActivities, initial)
  const pending = pendingActivities.filter(activity => activity.id !== initial?.id)
  return availableUnits(portfolio, accountId, instrumentId) + pending.reduce((total, activity) => total +
    activityUnitsEffectFor(activity, accountId, instrumentId) -
    activityUnitsEffectFor(activity.pendingOriginal ?? undefined, accountId, instrumentId), 0) -
    (replacement ? activityUnitsEffectFor(replacement, accountId, instrumentId) : 0)
}

/**
 * Checks a new or edited activity against held units and activity-specific rules.
 * Buy and fee activity may temporarily overdraw broker cash; explicit withdrawals
 * and conversions remain guarded by `validateCashFlowBalances` below.
 */
export function validateActivityBalances(
  portfolio: InvestmentPortfolio | null,
  draft: ActivityBalanceDraft,
  initial?: InvestmentActivity | null,
  pendingActivities: InvestmentActivity[] = [],
): BalanceIssue | null {
  if (!portfolio) return null
  const account = portfolio.accounts.find(value => value.id === draft.accountId)
  const instrument = portfolio.instruments.find(value => value.id === draft.instrumentId)
  if (!account || !instrument) return null

  const removed = -activityUnitsEffect(draft)
  if (removed > tolerance) {
    const heldUnits = availableActivityUnits(portfolio, draft.accountId, draft.instrumentId, pendingActivities, initial)
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

const cashFlowEffectFor = (flow: InvestmentCashFlow | null | undefined, accountId: string, currency: string) => {
  if (!flow || flow.accountId !== accountId) return 0
  return cashFlowEffects(flow)
    .filter(effect => same(effect.currency, currency))
    .reduce((total, effect) => total + effect.amount, 0)
}

const originalCashFlow = (
  pendingCashFlows: PendingInvestmentCashFlow[],
  initial?: InvestmentCashFlow | null,
) => {
  const queuedReplacement = pendingCashFlows.find(flow => flow.id === initial?.id)
  return queuedReplacement
    ? queuedReplacement.pendingOriginal ?? null
    : initial?.isPendingSync ? null : initial ?? null
}

/** Cash after applying net changes from locally queued cash movements. */
export const availableCashFlow = (
  portfolio: InvestmentPortfolio | null,
  accountId: string,
  currency: string,
  pendingCashFlows: PendingInvestmentCashFlow[] = [],
  initial?: InvestmentCashFlow | null,
) => {
  const replacement = originalCashFlow(pendingCashFlows, initial)
  const pending = pendingCashFlows.filter(flow => flow.id !== initial?.id)
  return availableCash(portfolio, accountId, currency) + pending.reduce((total, flow) => total +
    cashFlowEffectFor(flow, accountId, currency) -
    cashFlowEffectFor(flow.pendingOriginal ?? undefined, accountId, currency), 0) -
    (replacement ? cashFlowEffectFor(replacement, accountId, currency) : 0)
}

/**
 * Checks a withdrawal or conversion against the cash actually sitting in the
 * account. Deposits always pass.
 */
export function validateCashFlowBalances(
  portfolio: InvestmentPortfolio | null,
  draft: CashFlowBalanceDraft,
  initial?: InvestmentCashFlow | null,
  pendingCashFlows: InvestmentCashFlow[] = [],
): BalanceIssue | null {
  if (!portfolio) return null
  const account = portfolio.accounts.find(value => value.id === draft.accountId)
  if (!account) return null
  if (draft.type === 'Conversion' && same(draft.currency, draft.toCurrency)) {
    return { field: 'toCurrency', message: 'A conversion must use two different currencies.' }
  }
  if (draft.type === 'Deposit') return null

  const spent = -cashFlowEffects(draft)
    .filter(effect => same(effect.currency, draft.currency))
    .reduce((total, effect) => total + effect.amount, 0)
  if (spent <= tolerance) return null

  const held = availableCashFlow(portfolio, draft.accountId, draft.currency, pendingCashFlows, initial)
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
