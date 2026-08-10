import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecurringPaymentsView } from './RecurringPaymentsView'
import { BillTimeline } from './BillTimeline'
import type { RecurringPayment } from '../types'

// Characterization tests pinning RecurringPaymentsView behavior ahead of the
// Phase 7 decomposition. The existing RecurringPaymentsView.test.tsx already
// covers the add-form frequency selection; this file pins everything else:
// rendered card content, header stats, edit/delete/toggle flows, filtering and
// sorting, hideSensitive masking, BillTimeline integration, AI drafts, empty
// states, and form validation.

vi.mock('./BillTimeline', () => ({ BillTimeline: vi.fn(() => null) }))
vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <div role="dialog">{title}{children}</div>
  ),
}))
vi.mock('./ui/DatePicker', () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="billing date" type="date" value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

const payments: RecurringPayment[] = [
  {
    id: 'rp-1',
    name: 'Netflix',
    amount: -15.99,
    frequency: 'Monthly',
    category: 'Entertainment',
    ledgerCategory: 'Rewards',
    nextDueDate: '2026-07-15',
    dueDate: 15,
    startDate: '2026-07-15',
    active: true,
    paymentMode: 'Manual',
  },
  {
    id: 'rp-2',
    name: 'Insurance',
    amount: -240,
    frequency: 'Annually',
    category: 'Other',
    ledgerCategory: 'Essentials',
    nextDueDate: '2026-01-01',
    dueDate: 1,
    startDate: '2026-01-01',
    active: true,
    endDate: '2027-01-01',
    paymentMode: 'AutoDeduct',
  },
  {
    id: 'rp-3',
    name: 'Gym',
    amount: -35,
    frequency: 'Monthly',
    category: 'Other',
    ledgerCategory: 'Growth',
    nextDueDate: '2026-03-03',
    dueDate: 3,
    startDate: '2026-03-03',
    active: false,
    paymentMode: 'Manual',
  },
  {
    id: 'rp-4',
    name: 'Cloud Storage',
    amount: -2.99,
    frequency: 'Monthly',
    category: 'Software',
    ledgerCategory: 'Stability',
    nextDueDate: '2026-07-22',
    dueDate: 22,
    startDate: '2026-07-22',
    active: true,
    paymentMode: 'Manual',
  },
]

const makeProps = (overrides: Partial<React.ComponentProps<typeof RecurringPaymentsView>> = {}) => ({
  payments,
  activeRecurringPayments: [],
  transactions: [],
  selectedMonth: 'Jul',
  selectedYear: 2026,
  cycleDay: 28,
  onAddPayment: vi.fn(),
  onToggleActive: vi.fn(),
  onDeletePayment: vi.fn(),
  onUpdatePayment: vi.fn(),
  categories: [{ id: 'bills', name: 'Bills' }, { id: 'software', name: 'Software' }],
  ...overrides,
})

// Each subscription card is the closest ancestor with the p-6 card styling.
const getCard = (name: string): HTMLElement => {
  const heading = screen.getByRole('heading', { level: 3, name: new RegExp(name) })
  const card = heading.closest('div.p-6')
  if (!card) throw new Error(`card for ${name} not found`)
  return card as HTMLElement
}

const getToggleButton = (card: HTMLElement): HTMLElement => {
  return within(card).getByRole('switch', { name: /^(Pause|Resume) / })
}

// The name matcher is a regex because FormField appends an sr-only " (required)" to the label,
// which is this control's accessible name.
const choosePaymentMode = (label: 'Auto deduct' | 'Manual payment') => {
  fireEvent.click(screen.getByRole('combobox', { name: /How it's paid/ }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

describe('RecurringPaymentsView characterization', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })


  beforeEach(() => {
    vi.mocked(BillTimeline).mockClear()
  })

  describe('header stats', () => {
    it('normalizes annual amounts into the monthly total and skips paused subscriptions', () => {
      render(<RecurringPaymentsView {...makeProps()} />)
      // 15.99 (Netflix) + 240/12 (Insurance, annual) + 2.99 (Cloud Storage); Gym is paused.
      expect(screen.getByText('$38.98')).toBeTruthy()
      expect(screen.getByText('3 / 4')).toBeTruthy()
    })

    it('renders the skeleton instead of content while switching cycles', () => {
      const { container } = render(<RecurringPaymentsView {...makeProps({ isSwitchingCycle: true })} />)
      expect(screen.queryByText('Recurring Bills & Subscriptions')).toBeNull()
      expect(container.firstChild).not.toBeNull()
    })
  })

  describe('subscription cards', () => {
    it('renders amount, cadence suffix, billing start, recurrence line and ledger badge per payment', () => {
      render(<RecurringPaymentsView {...makeProps()} />)

      const netflix = getCard('Netflix')
      expect(within(netflix).getByText('$15.99')).toBeTruthy()
      expect(within(netflix).getByText('/mo')).toBeTruthy()
      expect(within(netflix).getByText('2026-07-15')).toBeTruthy()
      expect(within(netflix).getByText('Every month on the 15th')).toBeTruthy()
      expect(within(netflix).getByText('Rewards')).toBeTruthy()
      expect(within(netflix).getByText('Entertainment')).toBeTruthy()

      const insurance = getCard('Insurance')
      expect(within(insurance).getByText('$240.00')).toBeTruthy()
      expect(within(insurance).getByText('/yr')).toBeTruthy()
      expect(within(insurance).getByText('Every year on January 1st')).toBeTruthy()
      // End date row only renders when endDate is set
      expect(within(insurance).getByText('End Date')).toBeTruthy()
      expect(within(insurance).getByText('2027-01-01')).toBeTruthy()
      expect(within(netflix).queryByText('End Date')).toBeNull()

      const cloud = getCard('Cloud Storage')
      expect(within(cloud).getByText('Every month on the 22nd')).toBeTruthy()

      const gym = getCard('Gym')
      expect(within(gym).getByText('Every month on the 3rd')).toBeTruthy()
    })

    it('marks inactive payments with a Paused badge', () => {
      render(<RecurringPaymentsView {...makeProps()} />)
      const gym = getCard('Gym')
      expect(within(gym).getByText('Paused')).toBeTruthy()
      expect(within(getCard('Netflix')).queryByText('Paused')).toBeNull()
    })

    it('shows the teaching empty state when there are no payments at all', () => {
      render(<RecurringPaymentsView {...makeProps({ payments: [] })} />)
      expect(screen.getByText(/You don't have any subscription added yet/)).toBeTruthy()
    })
  })

  describe('toggle and delete flows', () => {
    it('invokes onToggleActive with the payment id from the status toggle', () => {
      const onToggleActive = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onToggleActive })} />)
      fireEvent.click(getToggleButton(getCard('Netflix')))
      expect(onToggleActive).toHaveBeenCalledWith('rp-1')
    })

    it('invokes onDeletePayment with the payment id', () => {
      const onDeletePayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onDeletePayment })} />)
      fireEvent.click(within(getCard('Insurance')).getByRole('button', { name: /Delete/ }))
      expect(onDeletePayment).toHaveBeenCalledWith('rp-2')
    })

    it('disables row actions while a payment is deleting or syncing', () => {
      render(<RecurringPaymentsView {...makeProps({ deletingId: 'rp-1' })} />)
      const netflix = getCard('Netflix')
      expect((within(netflix).getByRole('button', { name: /Edit/ }) as HTMLButtonElement).disabled).toBe(true)
      expect((within(netflix).getByRole('button', { name: /Delete/ }) as HTMLButtonElement).disabled).toBe(true)
      expect((getToggleButton(netflix) as HTMLButtonElement).disabled).toBe(true)
      // other rows unaffected
      expect((within(getCard('Insurance')).getByRole('button', { name: /Delete/ }) as HTMLButtonElement).disabled).toBe(false)
    })
  })

  describe('edit flow', () => {
    it('prefills the form from the payment and submits via onUpdatePayment preserving id and active flag', () => {
      const onUpdatePayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onUpdatePayment })} />)

      fireEvent.click(within(getCard('Netflix')).getByRole('button', { name: /Edit/ }))
      expect(screen.getByText('Edit Subscription')).toBeTruthy()

      const nameInput = screen.getByPlaceholderText('e.g. Netflix, Spotify') as HTMLInputElement
      expect(nameInput.value).toBe('Netflix')
      expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('15.99')
      expect((screen.getAllByLabelText('billing date')[0] as HTMLInputElement).value).toBe('2026-07-15')

      fireEvent.change(nameInput, { target: { value: 'Netflix Premium' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(onUpdatePayment).toHaveBeenCalledWith('rp-1', expect.objectContaining({
        id: 'rp-1',
        name: 'Netflix Premium',
        amount: -15.99,
        frequency: 'Monthly',
        category: 'Entertainment',
        ledgerCategory: 'Rewards',
        dueDate: 15,
        startDate: '2026-07-15',
        active: true,
      }))
    })

    it('normalizes an out-of-enum ledger category to Essentials when editing', () => {
      const onUpdatePayment = vi.fn()
      const legacy = [{ ...payments[0], ledgerCategory: 'LegacyBucket' }]
      render(<RecurringPaymentsView {...makeProps({ payments: legacy, onUpdatePayment })} />)
      fireEvent.click(within(getCard('Netflix')).getByRole('button', { name: /Edit/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(onUpdatePayment).toHaveBeenCalledWith('rp-1', expect.objectContaining({ ledgerCategory: 'Essentials' }))
    })
  })

  describe('add form validation and cancel', () => {
    it('keeps the optional marker with the end-date label', () => {
      render(<RecurringPaymentsView {...makeProps()} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))

      expect(screen.getByText('End billing date (optional)')).toBeTruthy()
      expect(screen.queryByText('Optional')).toBeNull()
    })

    it('shows field errors and does not submit when required fields are missing', () => {
      const onAddPayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onAddPayment })} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

      expect(screen.getByText('Subscription name is required.')).toBeTruthy()
      expect(screen.getByText('Billing amount is required.')).toBeTruthy()
      expect(screen.getByText('Start billing date is required.')).toBeTruthy()
      expect(screen.getByText('Choose whether this bill is auto deducted or paid manually.')).toBeTruthy()
      expect(onAddPayment).not.toHaveBeenCalled()
    })

    // The mode has no default on purpose: guessing it would either offer Pay Early on a direct
    // debit or hide it from a bill the user does pay by hand.
    it('blocks an otherwise complete submission until a payment mode is chosen', () => {
      const onAddPayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onAddPayment })} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Water Bill' } })
      fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '42.50' } })
      fireEvent.change(screen.getAllByLabelText('billing date')[0], { target: { value: '2026-07-31' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

      expect(screen.getByText('Choose whether this bill is auto deducted or paid manually.')).toBeTruthy()
      expect(onAddPayment).not.toHaveBeenCalled()

      choosePaymentMode('Auto deduct')
      expect(screen.queryByText('Choose whether this bill is auto deducted or paid manually.')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

      expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentMode: 'AutoDeduct' }))
    })

    it('carries the chosen manual mode into the new subscription', () => {
      const onAddPayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onAddPayment })} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Rent' } })
      fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '900.00' } })
      fireEvent.change(screen.getAllByLabelText('billing date')[0], { target: { value: '2026-07-05' } })
      choosePaymentMode('Manual payment')
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

      expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentMode: 'Manual' }))
    })

    it('rejects a non-positive amount', () => {
      const onAddPayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onAddPayment })} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Test' } })
      // The currency mask keeps the leading minus ('-5' -> '-0.05'), which
      // parses negative and must be rejected. (A bare '0' is masked to an empty
      // string and hits the required-field error instead.)
      fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '-5' } })
      fireEvent.change(screen.getAllByLabelText('billing date')[0], { target: { value: '2026-07-20' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

      expect(screen.getByText('Please enter a valid amount greater than 0.')).toBeTruthy()
      expect(onAddPayment).not.toHaveBeenCalled()
    })

    it('clamps the due day parsed from the start date and stores the amount as a negative outlay', () => {
      const onAddPayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ onAddPayment })} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Water Bill' } })
      fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '42.50' } })
      fireEvent.change(screen.getAllByLabelText('billing date')[0], { target: { value: '2026-07-31' } })
      choosePaymentMode('Manual payment')
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

      expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Water Bill',
        amount: -42.5,
        dueDate: 31,
        startDate: '2026-07-31',
        nextDueDate: '2026-08-31',
        active: true,
        endDate: undefined,
      }))
    })

    it('cancel resets the form so reopening starts blank', () => {
      render(<RecurringPaymentsView {...makeProps()} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Draft name' } })
      // Both the header toggle and the form footer read "Cancel" while the
      // sheet is open; either path runs handleCancelForm.
      fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
      expect(screen.queryByPlaceholderText('e.g. Netflix, Spotify')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      expect((screen.getByPlaceholderText('e.g. Netflix, Spotify') as HTMLInputElement).value).toBe('')
    })
  })

  describe('filtering and sorting', () => {
    it('filters cards by ledger category and shows the no-match empty state', async () => {
      render(<RecurringPaymentsView {...makeProps()} />)

      fireEvent.click(screen.getByRole('button', { name: /All Categories/ }))
      fireEvent.click(screen.getByRole('checkbox', { name: /Essentials/ }))

      expect(screen.getByRole('heading', { level: 3, name: /Insurance/ })).toBeTruthy()
      // Filtered-out cards animate out via AnimatePresence, so removal is async
      await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: /Netflix/ })).toBeNull())
      expect(screen.getByText('1 category filter active')).toBeTruthy()

      // Swap the filter to a different bucket
      fireEvent.click(screen.getByRole('checkbox', { name: /Essentials/ }))
      fireEvent.click(screen.getByRole('checkbox', { name: /Rewards/ }))
      expect(screen.getByRole('heading', { level: 3, name: /Netflix/ })).toBeTruthy()
      await waitFor(() => expect(screen.queryByRole('heading', { level: 3, name: /Insurance/ })).toBeNull())

      fireEvent.click(screen.getByText('Clear All'))
      expect(screen.getByText('All Categories')).toBeTruthy()
      expect(screen.getByRole('heading', { level: 3, name: /Insurance/ })).toBeTruthy()
    })

    it('shows the filter-mismatch empty state when no payment matches', () => {
      render(<RecurringPaymentsView {...makeProps({ payments: [payments[0]] })} />)
      fireEvent.click(screen.getByRole('button', { name: /All Categories/ }))
      fireEvent.click(screen.getByRole('checkbox', { name: /Stability/ }))
      expect(screen.getByText('No subscriptions match your filter criteria.')).toBeTruthy()
    })

    it('sorts by absolute amount descending by default and re-sorts by name', () => {
      render(<RecurringPaymentsView {...makeProps()} />)
      const names = () => screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent || '')

      expect(names().map(n => n.replace('Paused', ''))).toEqual(['Insurance', 'Gym', 'Netflix', 'Cloud Storage'])

      fireEvent.click(screen.getByRole('combobox', { name: 'Sort recurring payments' }))
      fireEvent.click(screen.getByRole('option', { name: 'Sort by: Name (A-Z)' }))
      expect(names().map(n => n.replace('Paused', ''))).toEqual(['Cloud Storage', 'Gym', 'Insurance', 'Netflix'])

      fireEvent.click(screen.getByRole('combobox', { name: 'Sort recurring payments' }))
      fireEvent.click(screen.getByRole('option', { name: 'Sort by: Next Due Date' }))
      expect(names().map(n => n.replace('Paused', ''))).toEqual(['Insurance', 'Gym', 'Netflix', 'Cloud Storage'])
    })
  })

  describe('hideSensitive masking', () => {
    it('replaces amounts with the shared mask and disables edit, delete and toggle', () => {
      const onDeletePayment = vi.fn()
      render(<RecurringPaymentsView {...makeProps({ hideSensitive: true, onDeletePayment })} />)

      const netflix = getCard('Netflix')
      expect(within(netflix).queryByText('$15.99')).toBeNull()
      expect(within(netflix).getByRole('img', { name: 'Sensitive amount hidden' })).toBeTruthy()

      const editButton = within(netflix).getByRole('button', { name: /Edit/ }) as HTMLButtonElement
      const deleteButton = within(netflix).getByRole('button', { name: /Delete/ }) as HTMLButtonElement
      expect(editButton.disabled).toBe(true)
      expect(editButton.title).toBe('Unhide balances to edit')
      expect(deleteButton.disabled).toBe(true)
      expect((getToggleButton(netflix) as HTMLButtonElement).disabled).toBe(true)

      fireEvent.click(deleteButton)
      expect(onDeletePayment).not.toHaveBeenCalled()
    })

    it('shows amounts when hideSensitive is off', () => {
      render(<RecurringPaymentsView {...makeProps()} />)
      expect(within(getCard('Netflix')).getByText('$15.99')).toBeTruthy()
    })

    it('closes and clears an open add sheet when sensitive mode activates', () => {
      const onAddPayment = vi.fn()
      const { rerender } = render(<RecurringPaymentsView {...makeProps({ onAddPayment })} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
      fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Private draft' } })

      rerender(<RecurringPaymentsView {...makeProps({ hideSensitive: true, onAddPayment })} />)

      expect(screen.queryByPlaceholderText('e.g. Netflix, Spotify')).toBeNull()
      expect((screen.getByRole('button', { name: 'New Subscription' }) as HTMLButtonElement).disabled).toBe(true)
      expect(onAddPayment).not.toHaveBeenCalled()
    })
  })

  describe('BillTimeline integration', () => {
    it('passes the timeline card its cycle, data and masking props', () => {
      render(<RecurringPaymentsView {...makeProps({ hideSensitive: true, currency: 'MYR' })} />)
      expect(vi.mocked(BillTimeline)).toHaveBeenCalled()
      const props = vi.mocked(BillTimeline).mock.calls[0][0]
      expect(props).toMatchObject({
        title: 'Subscriptions Billing Timeline',
        cycleOffset: 0,
        allPayments: payments,
        transactions: [],
        selectedMonth: 'Jul',
        selectedYear: 2026,
        cycleDay: 28,
        currency: 'MYR',
        hideSensitive: true,
      })
      expect(props.activeRecurringPayments).toEqual([])
    })
  })

  describe('AI drafts', () => {
    it('opens the add form prefilled from aiDraft fields and consumes the draft', () => {
      const onAiDraftConsumed = vi.fn()
      const onAddPayment = vi.fn()
      render(
        <RecurringPaymentsView
          {...makeProps({ onAddPayment, onAiDraftConsumed })}
          aiDraft={{ nonce: 1, fields: { name: 'Disney+', amount: 12.5, frequency: 'Annually', startDate: '2026-08-01', ledgerCategory: 'Rewards' } }}
        />,
      )

      expect(onAiDraftConsumed).toHaveBeenCalled()
      expect(screen.getByText('Add New Recurring Payment')).toBeTruthy()
      expect((screen.getByPlaceholderText('e.g. Netflix, Spotify') as HTMLInputElement).value).toBe('Disney+')
      expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('12.50')

      // The assistant does not know how a bill leaves the account, so a draft cannot satisfy the
      // payment-mode requirement on the user's behalf.
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))
      expect(onAddPayment).not.toHaveBeenCalled()
      expect(screen.getByText('Choose whether this bill is auto deducted or paid manually.')).toBeTruthy()

      choosePaymentMode('Manual payment')
      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))
      expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Disney+',
        amount: -12.5,
        frequency: 'Annually',
        ledgerCategory: 'Rewards',
        startDate: '2026-08-01',
        dueDate: 1,
        active: true,
        paymentMode: 'Manual',
      }))
    })

    it('applies a payment mode supplied by an aiDraft', () => {
      const onAddPayment = vi.fn()
      render(
        <RecurringPaymentsView
          {...makeProps({ onAddPayment })}
          aiDraft={{ nonce: 1, fields: { name: 'Disney+', amount: 12.5, startDate: '2026-08-01', paymentMode: 'AutoDeduct' } }}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))
      expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentMode: 'AutoDeduct' }))
    })

    it('opens the edit form for an aiEditDraft target with changes applied on top', () => {
      const onAiEditDraftConsumed = vi.fn()
      render(
        <RecurringPaymentsView
          {...makeProps({ onAiEditDraftConsumed })}
          aiEditDraft={{ nonce: 1, id: 'rp-1', changes: { amount: 18 } }}
        />,
      )

      expect(onAiEditDraftConsumed).toHaveBeenCalled()
      expect(screen.getByText('Edit Subscription')).toBeTruthy()
      expect((screen.getByPlaceholderText('e.g. Netflix, Spotify') as HTMLInputElement).value).toBe('Netflix')
      expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('18.00')
    })

    it('consumes but ignores an aiEditDraft while hideSensitive is on', () => {
      const onAiEditDraftConsumed = vi.fn()
      render(
        <RecurringPaymentsView
          {...makeProps({ hideSensitive: true, onAiEditDraftConsumed })}
          aiEditDraft={{ nonce: 1, id: 'rp-1', changes: { amount: 18 } }}
        />,
      )
      expect(onAiEditDraftConsumed).toHaveBeenCalled()
      expect(screen.queryByText('Edit Subscription')).toBeNull()
    })

    it('consumes an aiEditDraft whose id matches no payment without opening the form', () => {
      const onAiEditDraftConsumed = vi.fn()
      render(
        <RecurringPaymentsView
          {...makeProps({ onAiEditDraftConsumed })}
          aiEditDraft={{ nonce: 1, id: 'rp-missing', changes: { amount: 18 } }}
        />,
      )
      expect(onAiEditDraftConsumed).toHaveBeenCalled()
      expect(screen.queryByText('Edit Subscription')).toBeNull()
    })
  })
})
