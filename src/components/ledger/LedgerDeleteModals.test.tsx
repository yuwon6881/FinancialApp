import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeleteTransactionModal, EditDisabledModal } from './LedgerDeleteModals'

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

  it('shows a busy state while attached vault documents are being deleted', () => {
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
        isConfirming
      />,
    )

    expect(screen.getByText('Deleting…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Deleting…' }).hasAttribute('disabled')).toBe(true)
  })

  it('explains that deleting a completion restores its commitment snapshot', () => {
    const completion = {
      id: 'savings-goal-completion-7-test',
      date: '2026-08-01',
      description: 'Completed commitment: Car service',
      category: 'Other',
      ledgerCategory: 'Rewards',
      amount: -1200,
      savingsGoalId: 7,
    }

    const { unmount } = render(
      <DeleteTransactionModal
        isOpen
        transaction={completion}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        formatSensitive={value => `MYR ${value.toFixed(2)}`}
      />,
    )

    expect(screen.getByText(/restores the amount and deadline/i)).toBeTruthy()
    expect(screen.getByText('MYR 1200.00')).toBeTruthy()
    unmount()

    render(<EditDisabledModal isOpen transaction={completion} onClose={vi.fn()} />)
    expect(screen.getByText(/edit the commitment, then complete it again/i)).toBeTruthy()
  })
})
