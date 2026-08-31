import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../../types'
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

  it('warns that undo cannot bring the attached files back', () => {
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
        alsoDeleteDocuments
      />,
    )

    expect(screen.getByText(/undo brings the transaction back, but not the files/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm Delete' }).hasAttribute('disabled')).toBe(false)
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

  it('explains that deleting a protected reward claim restores the reward', () => {
    const claim: Transaction = {
      id: 'reward-claim',
      date: '2026-08-01',
      description: 'Purchased: Camera (Wish List)',
      category: 'Other',
      ledgerCategory: 'Rewards',
      amount: -800,
      wishlistItemId: 9,
    }

    const { unmount } = render(
      <DeleteTransactionModal
        isOpen
        transaction={claim}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        formatSensitive={value => `MYR ${value.toFixed(2)}`}
      />,
    )
    expect(screen.getByText(/restores the reward so it can be claimed again/i)).toBeTruthy()
    unmount()

    render(<EditDisabledModal isOpen transaction={claim} onClose={vi.fn()} />)
    expect(screen.getByText(/delete it to restore the reward, then claim it again/i)).toBeTruthy()
  })
})
