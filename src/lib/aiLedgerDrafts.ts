import type { LedgerAccount, Transaction, TransactionCategory } from '../types'
import { capitalizeWords } from './utils'
import { isSystemCategoryName } from './categoryFlow'

// Transfer legs move between allocation buckets, so Income is never a valid leg.
const LEDGERS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
// Income only applies to an inflow — it is what triggers the income auto-split, the
// same shape the manual transaction form produces for a positive amount.
const INFLOW_LEDGERS = [...LEDGERS, 'Income'] as const

const text = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' && record[key].trim() ? record[key].trim() : null

const number = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function localIsoDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * The account a drafted bucket leg lands in, using the same rule the transaction form applies: a
 * bucket holding exactly one open account preselects it, and one holding several leaves the choice
 * to the person reviewing the draft. The assistant may name an account only when the user did --
 * with an "@" mention or the exact name -- so guessing between two would put money somewhere
 * nobody chose; leaving it undefined instead surfaces the required field in the draft editor,
 * which is the gate every other writer goes through.
 */
function soleLiveAccountId(
  accounts: LedgerAccount[],
  bucket: string | undefined,
): string | undefined {
  if (!bucket) return undefined
  const live = accounts.filter(account =>
    account.bucket.toLowerCase() === bucket.toLowerCase() && !account.isArchived)
  return live.length === 1 ? live[0].id : undefined
}

function explicitLiveAccountId(
  accounts: LedgerAccount[],
  rawId: string | undefined,
  bucket: string | undefined,
): string | undefined {
  if (!rawId || !bucket) return undefined
  const match = accounts.find(account =>
    account.id === rawId && !account.isArchived && account.bucket.toLowerCase() === bucket.toLowerCase())
  return match?.id
}

/**
 * The description a transfer keeps when the user gave none. Naming the two sides is what the row
 * is: "Transfer CIMB to RYT" reads the same in the ledger as it did in the request, where a blank
 * description would have failed the draft editor's required field for a complete instruction.
 */
function transferDescription(
  supplied: string | null,
  accounts: LedgerAccount[],
  accountId: string | undefined,
  counterAccountId: string | undefined,
  source: string,
  target: string,
): string {
  if (supplied) return capitalizeWords(supplied)
  const nameOf = (id: string | undefined, fallback: string) =>
    accounts.find(account => account.id === id)?.name ?? fallback
  return `Transfer ${nameOf(accountId, source)} to ${nameOf(counterAccountId, target)}`
}

/** Convert a validated AI ledger-add payload into local staging records. */
export function buildAiLedgerDraftTransactions(
  payload: Record<string, unknown>,
  categories: TransactionCategory[],
  accounts: LedgerAccount[] = [],
  defaultDate = localIsoDate(),
): Omit<Transaction, 'id'>[] {
  const rawRecords = Array.isArray(payload.transactions) ? payload.transactions : [payload]
  const normalNames = categories
    .filter(category => !category.isPendingDelete)
    .map(category => category.name.trim())
    .filter(name => !!name && !isSystemCategoryName(name))
  const categoriesByName = new Map(normalNames.map(name => [name.toLowerCase(), name]))
  const fallbackCategory = categoriesByName.get('other') ?? normalNames[0] ?? ''

  return rawRecords.flatMap((raw): Omit<Transaction, 'id'>[] => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const fields = raw as Record<string, unknown>
    const rawDescription = text(fields, 'description')
    const magnitude = number(fields, 'amount')
    if (magnitude == null || magnitude <= 0) return []

    const rawType = text(fields, 'txType')?.toLowerCase()
    const txType = rawType === 'inflow' || rawType === 'transfer' ? rawType : 'outflow'
    // Moving money is a complete instruction without a description: the two sides already name
    // the row. Only a spend or a deposit genuinely needs one, so only those are refused for it.
    if (!rawDescription && txType !== 'transfer') return []
    const requestedCategory = text(fields, 'category')?.toLowerCase()
    const category = (requestedCategory && categoriesByName.get(requestedCategory)) || fallbackCategory
    const rawLedger = text(fields, 'ledgerCategory')?.toLowerCase().replace(/^reward$/, 'rewards')
    // AccountMove is a persisted internal marker, never a ledger category the assistant may name
    // directly. It is reached only through the transfer branch below, and only once the user has
    // pointed at both accounts with an "@" mention.
    if (rawLedger === 'accountmove') return []
    const allowedLedgers = txType === 'inflow' ? INFLOW_LEDGERS : LEDGERS
    const defaultLedger = txType === 'inflow' ? 'Income' : 'Essentials'
    const ledger = fields.ledgerCategorySpecified === true
      ? allowedLedgers.find(candidate => candidate.toLowerCase() === rawLedger) ?? defaultLedger
      : defaultLedger
    const rawDate = text(fields, 'date')
    const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : defaultDate

    if (txType === 'transfer') {
      const source = LEDGERS.find(candidate => candidate.toLowerCase() === text(fields, 'transferSource')?.toLowerCase())
      const target = LEDGERS.find(candidate => candidate.toLowerCase() === text(fields, 'transferTarget')?.toLowerCase())
      if (!source || !target) return []
      const accountId = explicitLiveAccountId(accounts, text(fields, 'accountId') ?? undefined, source)
        ?? soleLiveAccountId(accounts, source)
      const counterAccountId = explicitLiveAccountId(accounts, text(fields, 'counterAccountId') ?? undefined, target)
        ?? soleLiveAccountId(accounts, target)
      // Two accounts in one bucket is an internal account move: the bucket total is unchanged,
      // the money has only changed hands. It is only expressible once both ends are exact, which
      // is what an "@" mention supplies -- guessing either side would move money nobody chose.
      if (source === target) {
        if (!accountId || !counterAccountId || accountId === counterAccountId) return []
        return [{
          description: transferDescription(rawDescription, accounts, accountId, counterAccountId, source, target),
          amount: magnitude,
          category: 'Transfer',
          ledgerCategory: 'AccountMove',
          date,
          accountId,
          counterAccountId,
          isPendingSync: true,
        }]
      }
      return [{
        description: transferDescription(rawDescription, accounts, accountId, counterAccountId, source, target),
        amount: magnitude,
        category: 'Transfer',
        ledgerCategory: `Transfer:${source}->${target}`,
        date,
        accountId,
        counterAccountId,
        isPendingSync: true,
      }]
    }

    const description = capitalizeWords(rawDescription!)
    if (!category) return []
    // An Income row is split four ways by the server, so it names a receiving account per bucket
    // rather than one for itself -- the same shape the manual form produces.
    const placement = ledger === 'Income'
      ? {
          splitAccountIds: Object.fromEntries(LEDGERS
            .map(bucket => [bucket, soleLiveAccountId(accounts, bucket)])
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
        }
      : {
          accountId: explicitLiveAccountId(accounts, text(fields, 'accountId') ?? undefined, ledger)
            ?? soleLiveAccountId(accounts, ledger),
        }
    return [{
      description,
      amount: txType === 'inflow' ? magnitude : -magnitude,
      category,
      ledgerCategory: ledger,
      date,
      ...placement,
      isPendingSync: true,
    }]
  })
}
