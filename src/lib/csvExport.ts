import type { LedgerAccount, Transaction } from '../types'
import { displayLedgerCategory } from './utils'
import { Capacitor } from '@capacitor/core'

/** Excel reads a BOM-less UTF-8 CSV as the system codepage; the server export writes one too. */
const UTF8_BOM = '\ufeff'

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
    const ledgerCategory = t.ledgerCategory || ''
    const isAccountMove = ledgerCategory.toLowerCase() === 'accountmove'
    // Case-insensitive, matching the server export and `ledgerTotals`. A case-only difference put
    // the same row in the movement column on one path and in debit/credit on the other.
    const isTransfer = ledgerCategory.toLowerCase().startsWith('transfer:') || isAccountMove
    const ledgerAllocation = isAccountMove
      ? 'Between accounts'
      : isTransfer
      ? ledgerCategory.substring('Transfer:'.length).replace('->', ' -> ')
      : displayLedgerCategory(ledgerCategory)
    return [
      escapeCsvField(t.date),
      escapeCsvTextField(t.description),
      escapeCsvTextField(t.category),
      escapeCsvField(ledgerAllocation),
      !isTransfer && isOutflow ? escapeCsvField(Math.abs(t.amount).toFixed(2)) : '',
      !isTransfer && !isOutflow ? escapeCsvField(t.amount.toFixed(2)) : '',
      isTransfer ? escapeCsvField(Math.abs(t.amount).toFixed(2)) : '',
      // The name or nothing — never the id. The account list is optional here and omits archived
      // accounts, so falling back to the id spilled opaque identifiers into a column the server
      // export leaves blank in exactly the same situation.
      escapeCsvTextField((t.accountId && accountNames.get(t.accountId)) || ''),
    ]
  })
  return [headers.join(','), ...dataRows.map(e => e.join(','))].join('\n')
}

export async function downloadCsvBlob(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { shareBlobAsNativeFile } = await import('./native/shareFile')
    await shareBlobAsNativeFile(blob, filename)
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function downloadCsvRows(rows: Transaction[], filename: string, accounts: ReadonlyArray<Pick<LedgerAccount, 'id' | 'name'>> = []): Promise<void> {
  const csvContent = buildCsvContent(rows, accounts)
  // Byte-order mark, as the server export writes: without it Excel reads the UTF-8 bytes as the
  // system codepage, so a page exported from here mangled non-ASCII text that the full export kept.
  const csvBlob = new Blob([UTF8_BOM, csvContent], { type: 'text/csv;charset=utf-8;' })
  await downloadCsvBlob(csvBlob, filename)
}
