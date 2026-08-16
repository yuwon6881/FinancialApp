import type { LedgerAccount, Transaction, TransactionCategory } from '../types'
import { capitalizeWords } from './utils'

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
 * to the person reviewing the draft. The assistant is never told which accounts exist, so guessing
 * between two would put money somewhere nobody chose; leaving it undefined instead surfaces the
 * required field in the draft editor, which is the gate every other writer goes through.
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
    .filter(name => !!name && !['transfer', 'adjustment'].includes(name.toLowerCase()))
  const categoriesByName = new Map(normalNames.map(name => [name.toLowerCase(), name]))
  const fallbackCategory = categoriesByName.get('other') ?? normalNames[0] ?? ''

  return rawRecords.flatMap((raw): Omit<Transaction, 'id'>[] => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const fields = raw as Record<string, unknown>
    const rawDescription = text(fields, 'description')
    const magnitude = number(fields, 'amount')
    if (!rawDescription || magnitude == null || magnitude <= 0) return []
    const description = capitalizeWords(rawDescription)

    const rawType = text(fields, 'txType')?.toLowerCase()
    const txType = rawType === 'inflow' || rawType === 'transfer' ? rawType : 'outflow'
    const requestedCategory = text(fields, 'category')?.toLowerCase()
    const category = (requestedCategory && categoriesByName.get(requestedCategory)) || fallbackCategory
    const rawLedger = text(fields, 'ledgerCategory')?.toLowerCase().replace(/^reward$/, 'rewards')
    // AccountMove is a persisted internal marker, not a route the assistant is allowed to
    // invent. It requires two same-bucket account ids that are unavailable to this draft parser.
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
      if (!source || !target || source === target) return []
      return [{
        description,
        amount: magnitude,
        category: 'Transfer',
        ledgerCategory: `Transfer:${source}->${target}`,
        date,
        accountId: explicitLiveAccountId(accounts, text(fields, 'accountId') ?? undefined, source)
          ?? soleLiveAccountId(accounts, source),
        counterAccountId: explicitLiveAccountId(accounts, text(fields, 'counterAccountId') ?? undefined, target)
          ?? soleLiveAccountId(accounts, target),
        isPendingSync: true,
      }]
    }

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
