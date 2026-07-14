import type { Transaction, TransactionCategory } from '../types'
import { capitalizeWords } from './utils'

const LEDGERS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const

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

/** Convert a validated AI ledger-add payload into local staging records. */
export function buildAiLedgerDraftTransactions(
  payload: Record<string, unknown>,
  categories: TransactionCategory[],
  defaultDate = localIsoDate(),
): Omit<Transaction, 'id'>[] {
  const rawRecords = Array.isArray(payload.transactions) ? payload.transactions : [payload]
  const normalNames = categories
    .filter(category => !category.isPendingDelete)
    .map(category => category.name.trim())
    .filter(name => !!name && !['transfer', 'adjustment'].includes(name.toLowerCase()))
  const categoriesByName = new Map(normalNames.map(name => [name.toLowerCase(), name]))
  const fallbackCategory = categoriesByName.get('other') ?? normalNames[0] ?? ''

  return rawRecords.flatMap(raw => {
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
    const ledger = fields.ledgerCategorySpecified === true
      ? LEDGERS.find(candidate => candidate.toLowerCase() === rawLedger) ?? 'Essentials'
      : 'Essentials'
    const rawDate = text(fields, 'date')
    const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : defaultDate

    if (txType === 'transfer') {
      const source = LEDGERS.find(candidate => candidate.toLowerCase() === text(fields, 'transferSource')?.toLowerCase())
      const target = LEDGERS.find(candidate => candidate.toLowerCase() === text(fields, 'transferTarget')?.toLowerCase())
      if (!source || !target || source === target) return []
      return [{ description, amount: magnitude, category: 'Transfer', ledgerCategory: `Transfer:${source}->${target}`, date, isPendingSync: true }]
    }

    if (!category) return []
    return [{ description, amount: txType === 'inflow' ? magnitude : -magnitude, category, ledgerCategory: ledger, date, isPendingSync: true }]
  })
}
