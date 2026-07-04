import type { Transaction } from '../types'
import { displayLedgerCategory } from './utils'

export function escapeCsvField(val: string | number): string {
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
export function escapeCsvTextField(val: string): string {
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

export function buildCsvContent(rows: Transaction[]): string {
  const headers = ['Date', 'Description', 'Category', 'Ledger Category', 'Debit (Outflow)', 'Credit (Inflow)']
  const dataRows = rows.map(t => {
    const isOutflow = t.amount < 0
    const isTransfer = (t.ledgerCategory || '').startsWith('Transfer:')
    return [
      escapeCsvField(t.date),
      escapeCsvTextField(t.description),
      escapeCsvTextField(t.category),
      escapeCsvField(displayLedgerCategory(t.ledgerCategory)),
      isTransfer ? escapeCsvField(t.amount.toFixed(2)) : (isOutflow ? escapeCsvField(Math.abs(t.amount).toFixed(2)) : ''),
      isTransfer ? escapeCsvField(t.amount.toFixed(2)) : (!isOutflow ? escapeCsvField(t.amount.toFixed(2)) : '')
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

export function downloadCsvRows(rows: Transaction[], filename: string): void {
  const csvContent = buildCsvContent(rows)
  const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadCsvBlob(csvBlob, filename)
}
