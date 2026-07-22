import { describe, expect, it } from 'vitest'
import { getLedgerTransactionRowElement, ledgerTransactionRowId } from './ledgerTransactionTarget'

describe('ledger transaction targets', () => {
  it('uses distinct IDs for the simultaneously rendered responsive layouts', () => {
    expect(ledgerTransactionRowId('tx-1', 'desktop')).toBe('tx-row-desktop-tx-1')
    expect(ledgerTransactionRowId('tx-1', 'mobile')).toBe('tx-row-mobile-tx-1')
  })

  it('selects the mobile card rather than the hidden desktop row on mobile', () => {
    const desktop = document.createElement('div')
    desktop.id = ledgerTransactionRowId('tx-1', 'desktop')
    const mobile = document.createElement('div')
    mobile.id = ledgerTransactionRowId('tx-1', 'mobile')
    document.body.append(desktop, mobile)

    expect(getLedgerTransactionRowElement('tx-1', true)).toBe(mobile)
    expect(getLedgerTransactionRowElement('tx-1', false)).toBe(desktop)

    desktop.remove()
    mobile.remove()
  })
})
