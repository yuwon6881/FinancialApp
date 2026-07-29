import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeleteTransactionModal } from './LedgerDeleteModals'

describe('DeleteTransactionModal document safety', () => {
  it('keeps attached documents by default', () => {
    render(
      <DeleteTransactionModal
        isOpen
        transaction={{
          id: 'transaction-1',
          date: '2026-07-29',
          description: 'Tax payment',
          category: 'Other',
          ledgerCategory: 'Essentials',
          amount: -100,
        }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        formatSensitive={value => value.toFixed(2)}
        attachedDocumentCount={2}
        onAlsoDeleteDocumentsChange={vi.fn()}
      />,
    )

    expect(screen.getByText(/2 documents are attached/).textContent).toContain('they will be kept')
    expect((screen.getByRole('checkbox', { name: /also delete attached documents/i }) as HTMLInputElement).checked).toBe(false)
  })

  it('disables document deletion while offline', () => {
    render(
      <DeleteTransactionModal
        isOpen
        transaction={{
          id: 'transaction-1',
          date: '2026-07-29',
          description: 'Tax payment',
          category: 'Other',
          ledgerCategory: 'Essentials',
          amount: -100,
        }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        formatSensitive={value => value.toFixed(2)}
        attachedDocumentCount={1}
        isOnline={false}
      />,
    )

    expect((screen.getByRole('checkbox', { name: /also delete attached documents/i }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/cannot delete vault documents while offline/i)).toBeTruthy()
  })
})
