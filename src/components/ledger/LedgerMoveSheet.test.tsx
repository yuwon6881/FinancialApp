import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../../types'
import { LedgerMoveSheet } from './LedgerMoveSheet'

const queueMutation = vi.fn(() => true)
const guardSensitive = vi.fn(() => true)

vi.mock('../../contexts/AppContext', () => ({
  useAppContext: () => ({ queueMutation, guardSensitive }),
}))

// The real DatePicker is a button plus a calendar popover. These tests are about the sheet's own
// destination-date state surviving a re-render, so a plain input keeps them focused on that
// instead of on how a day cell is reached.
vi.mock('../ui/DatePicker', () => ({
  DatePicker: ({ value, onChange, ariaLabel }: {
    value: string
    onChange: (next: string) => void
    ariaLabel?: string
  }) => (
    <input aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

const transaction = (id: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id,
  date: '2026-08-01',
  description: id,
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -10,
  ...overrides,
})

const props = (transactions: Transaction[]) => ({
  transactions,
  cycleDay: 1,
  isOpen: true,
  onClose: vi.fn(),
  onMoved: vi.fn(),
})

const destinationInput = () => screen.getByLabelText('Destination transaction date') as HTMLInputElement
const confirm = () => screen.getByRole('button', { name: 'Move' })

describe('LedgerMoveSheet', () => {
  beforeEach(() => {
    queueMutation.mockClear()
    guardSensitive.mockClear()
  })

  it('keeps the chosen destination date when the parent re-renders with an equivalent selection', () => {
    // Bulk selections rebuild their transaction array on every render, and sync ticks re-render the
    // ledger constantly. Resetting the destination on that made Confirm queue the source date, so a
    // bulk move looked like it worked and moved nothing.
    const rows = [transaction('tx-1'), transaction('tx-2')]
    const { rerender } = render(<LedgerMoveSheet {...props(rows)} />)

    fireEvent.change(destinationInput(), { target: { value: '2026-09-15' } })
    expect(destinationInput().value).toBe('2026-09-15')

    rerender(<LedgerMoveSheet {...props([transaction('tx-1'), transaction('tx-2')])} />)

    expect(destinationInput().value).toBe('2026-09-15')

    fireEvent.click(confirm())

    const [, , , payload] = queueMutation.mock.calls[0] as unknown as [string, string, string, {
      moves: { id: string; targetDate: string }[]
    }]
    expect(payload.moves).toEqual([
      { id: 'tx-1', targetDate: '2026-09-15' },
      { id: 'tx-2', targetDate: '2026-09-15' },
    ])
  })

  it('re-seeds the destination when the selection actually changes', () => {
    const { rerender } = render(<LedgerMoveSheet {...props([transaction('tx-1')])} />)
    fireEvent.change(destinationInput(), { target: { value: '2026-09-15' } })

    rerender(<LedgerMoveSheet {...props([transaction('tx-9', { date: '2026-07-04' })])} />)

    expect(destinationInput().value).toBe('2026-07-04')
  })

  it('defaults a single-row move to that row\'s own date', () => {
    render(<LedgerMoveSheet {...props([transaction('tx-1', { date: '2026-08-01' })])} />)

    expect(destinationInput().value).toBe('2026-08-01')
  })

  it('records the source dates so undo can restore them', () => {
    render(<LedgerMoveSheet {...props([transaction('tx-1', { date: '2026-08-01' })])} />)

    fireEvent.change(destinationInput(), { target: { value: '2026-09-15' } })
    fireEvent.click(confirm())

    const [, , , payload] = queueMutation.mock.calls[0] as unknown as [string, string, string, {
      beforeSnapshots: { id: string; date: string }[]
    }]
    expect(payload.beforeSnapshots).toEqual([{ id: 'tx-1', date: '2026-08-01' }])
  })

  it('mints a distinct queue key per move so two moves cannot share an undo snapshot', () => {
    const { unmount } = render(<LedgerMoveSheet {...props([transaction('tx-1')])} />)
    fireEvent.change(destinationInput(), { target: { value: '2026-09-15' } })
    fireEvent.click(confirm())
    unmount()

    render(<LedgerMoveSheet {...props([transaction('tx-2')])} />)
    fireEvent.change(destinationInput(), { target: { value: '2026-09-15' } })
    fireEvent.click(confirm())

    const keys = (queueMutation.mock.calls as unknown as unknown[][]).map(call => call[2])
    const [firstKey, secondKey] = keys
    expect(firstKey).not.toBe(secondKey)
  })

  it('blocks an ineligible row and explains why', () => {
    render(<LedgerMoveSheet {...props([transaction('tx-1', { recurringPaymentId: 'rec-1' })])} />)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect((confirm() as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(confirm())
    expect(queueMutation).not.toHaveBeenCalled()
  })

  it('does not queue anything when the sensitive-mode guard refuses', () => {
    guardSensitive.mockReturnValueOnce(false)
    render(<LedgerMoveSheet {...props([transaction('tx-1')])} />)

    fireEvent.change(destinationInput(), { target: { value: '2026-09-15' } })
    fireEvent.click(confirm())

    expect(queueMutation).not.toHaveBeenCalled()
  })
})
