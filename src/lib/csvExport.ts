import type { LedgerAccount, Transaction } from '../types'
import { displayLedgerCategory } from './utils'

function escapeCsvField(val: string | number): string {
  const str = String(val)
  // Wrap in quotes if it contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// User-editable text fields (description, category names) can start with a
// formula-trigger character; spreadsheet apps (Excel/Sheets/LibreOffice)
// evaluate a leading =, +, -, or @ as a formula (CSV injection). Prefix with
// an apostrophe to force it to render as literal text.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/
function escapeCsvTextField(val: string): string {
  return escapeCsvField(FORMULA_TRIGGER.test(val) ? `'${val}` : val)
}

export function toFilename(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/~/g, '-')
    .replace(/[,\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/_+$/g, '')
}

export function buildCsvContent(rows: Transaction[], accounts: ReadonlyArray<Pick<LedgerAccount, 'id' | 'name'>> = []): string {
  const accountNames = new Map(accounts.map(account => [account.id, account.name]))
  const headers = ['Date', 'Description', 'Category', 'Ledger Allocation', 'Debit (Outflow)', 'Credit (Inflow)', 'Internal Movement', 'Account']
  const dataRows = rows.map(t => {
    const isOutflow = t.amount < 0
    const isAccountMove = (t.ledgerCategory || '').toLowerCase() === 'accountmove'
    const isTransfer = (t.ledgerCategory || '').startsWith('Transfer:') || isAccountMove
    const ledgerAllocation = isAccountMove
      ? 'Between accounts'
      : isTransfer
      ? t.ledgerCategory.substring('Transfer:'.length).replace('->', ' -> ')
      : displayLedgerCategory(t.ledgerCategory)
    return [
      escapeCsvField(t.date),
      escapeCsvTextField(t.description),
      escapeCsvTextField(t.category),
      escapeCsvField(ledgerAllocation),
      !isTransfer && isOutflow ? escapeCsvField(Math.abs(t.amount).toFixed(2)) : '',
      !isTransfer && !isOutflow ? escapeCsvField(t.amount.toFixed(2)) : '',
      isTransfer ? escapeCsvField(Math.abs(t.amount).toFixed(2)) : '',
      t.accountId ? escapeCsvTextField(accountNames.get(t.accountId) ?? t.accountId) : '',
    ]
  })
  return [headers.join(','), ...dataRows.map(e => e.join(','))].join('\n')
}

export function downloadCsvBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadCsvRows(rows: Transaction[], filename: string, accounts: ReadonlyArray<Pick<LedgerAccount, 'id' | 'name'>> = []): void {
  const csvContent = buildCsvContent(rows, accounts)
  const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadCsvBlob(csvBlob, filename)
}
