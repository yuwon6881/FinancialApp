import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { RecurringBills } from './RecurringBills'
import { RECURRING_PAUSED_LABEL } from '../../lib/push/messages'
import type { ActiveRecurringPayment, RecurringPayment } from '../../types'

// The bill detail sits beside the list from 1280px; below that it opens as a sheet.
const jsdomWidth = window.innerWidth
beforeAll(() => { window.innerWidth = 1440 })
afterAll(() => { window.innerWidth = jsdomWidth })

const basePayment: RecurringPayment = {
  id: 'rp-1',
  name: 'Netflix',
  amount: -15,
  frequency: 'Monthly',
  category: 'Entertainment',
  ledgerCategory: 'Essentials',
  accountId: 'acct-essentials',
  nextDueDate: '2099-01-20',
  dueDate: 20,
  startDate: '2026-01-20',
  active: true,
  paymentMode: 'Manual',
}

const noop = () => {}

function renderCards(payments: RecurringPayment[], overrides: Partial<React.ComponentProps<typeof RecurringBills>> = {}) {
  return render(
    <RecurringBills
      payments={payments}
      occurrences={[]}
      totalCount={payments.length}
      hideSensitive={false}
      formatSensitive={val => `$${val.toFixed(2)}`}
      isPaymentSyncing={() => false}
      isPaymentDeleting={() => false}
      onToggleActive={noop}
      onDeletePayment={noop}
      onEditPayment={noop}
      globalPushEnabled
      {...overrides}
    />
  )
}

describe('RecurringBills reminder controls', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('starts a never-configured payment with the reminder off and no visible editor', () => {
    renderCards([basePayment])
    const toggle = screen.getByRole('switch', { name: 'Turn on payment reminder for Netflix' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('radiogroup', { name: 'Reminder frequency for Netflix' })).toBeNull()
  })

  it('enables the reminder with the Once/1-day defaults the server stores', () => {
    const onUpdateReminder = vi.fn()
    renderCards([basePayment], { onUpdateReminder })
    fireEvent.click(screen.getByRole('switch', { name: 'Turn on payment reminder for Netflix' }))
    expect(screen.getByRole('button', { name: 'Save Reminder' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save Reminder' }))
    expect(onUpdateReminder).toHaveBeenCalledWith('rp-1', { enabled: true, mode: 'Once', leadDays: 1 })
  })

  it('shows the editor with mode/lead chips and a live preview once a reminder is enabled', () => {
    const configured: RecurringPayment = { ...basePayment, reminderEnabled: true, reminderMode: 'Once', reminderLeadDays: 7 }
    renderCards([configured])

    expect(screen.getByRole('radio', { name: 'Once' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Daily' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('radio', { name: '7d' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText("One reminder 7 days before it's due.")).toBeTruthy()
  })

  it('switches to Daily mode while preserving the current lead days on save', () => {
    const onUpdateReminder = vi.fn()
    const configured: RecurringPayment = { ...basePayment, reminderEnabled: true, reminderMode: 'Once', reminderLeadDays: 2 }
    renderCards([configured], { onUpdateReminder })

    fireEvent.click(screen.getByRole('radio', { name: 'Daily' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Reminder' }))
    expect(onUpdateReminder).toHaveBeenCalledWith('rp-1', { enabled: true, mode: 'Daily', leadDays: 2 })
  })

  it('changes the lead time when a different chip is clicked and saved', () => {
    const onUpdateReminder = vi.fn()
    const configured: RecurringPayment = { ...basePayment, reminderEnabled: true, reminderMode: 'Once', reminderLeadDays: 3 }
    renderCards([configured], { onUpdateReminder })

    fireEvent.click(screen.getByRole('radio', { name: '1d' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Reminder' }))
    expect(onUpdateReminder).toHaveBeenCalledWith('rp-1', { enabled: true, mode: 'Once', leadDays: 1 })
  })

  it('dims the editor and shows the exact paused notice when push is globally off', () => {
    const configured: RecurringPayment = { ...basePayment, reminderEnabled: true }
    renderCards([configured], { globalPushEnabled: false })

    expect(screen.getByText(RECURRING_PAUSED_LABEL)).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Once' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('radio', { name: '3d' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not show the paused notice for a payment whose reminder is off', () => {
    renderCards([basePayment], { globalPushEnabled: false })
    expect(screen.queryByText(RECURRING_PAUSED_LABEL)).toBeNull()
  })

  it('renders an ended payment as ended and disables its reminder controls', () => {
    const ended: RecurringPayment = {
      ...basePayment,
      endDate: '2000-01-01',
      reminderEnabled: true,
    }
    renderCards([ended])

    expect(screen.getByText('Ended')).toBeTruthy()
    expect((screen.getByRole('switch', { name: 'Turn off payment reminder for Netflix' }) as HTMLButtonElement).disabled).toBe(true)
    // An ended bill is filed with the paused ones, saying when it stopped.
    const paused = screen.getByRole('region', { name: /Paused/ })
    expect(within(paused).getByText(/Ended (Jan 1|1 Jan),? 2000/)).toBeTruthy()
  })
})

describe('RecurringBills pay early', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('offers Pay Early for an active subscription whose next due date is in the future', () => {
    const onRequestPayEarly = vi.fn()
    renderCards([basePayment], { onRequestPayEarly })
    fireEvent.click(screen.getByRole('button', { name: /Pay Early/ }))
    expect(onRequestPayEarly).toHaveBeenCalledWith('rp-1')
  })

  it('hides Pay Early once the subscription is due or overdue', () => {
    const dueToday: RecurringPayment = { ...basePayment, nextDueDate: '1999-01-01' }
    renderCards([dueToday])
    expect(screen.queryByRole('button', { name: /Pay Early/ })).toBeNull()
  })

  it('hides Pay Early for a paused (inactive) subscription', () => {
    const inactive: RecurringPayment = { ...basePayment, active: false }
    renderCards([inactive])
    expect(screen.queryByRole('button', { name: /Pay Early/ })).toBeNull()
  })

  it('hides Pay Early for an auto deducted subscription', () => {
    const autoDeducted: RecurringPayment = { ...basePayment, paymentMode: 'AutoDeduct' }
    renderCards([autoDeducted])
    expect(screen.queryByRole('button', { name: /Pay Early/ })).toBeNull()
  })
})

describe('RecurringBills payment mode', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  // The card has to say which mode it is, otherwise an auto-deducted bill just looks like a card
  // whose Pay Early button went missing.
  it('states how a manual subscription is paid', () => {
    renderCards([basePayment])
    expect(screen.getByText('Manual payment')).toBeTruthy()
  })

  it('states how an auto deducted subscription is paid', () => {
    renderCards([{ ...basePayment, paymentMode: 'AutoDeduct' }])
    expect(screen.getByText('Auto deduct')).toBeTruthy()
  })
})

describe('RecurringBills loan links', () => {
  it('identifies the linked loan and keeps delete visible but disabled', () => {
    const onDeletePayment = vi.fn()
    const onNavigateToLoan = vi.fn()
    renderCards([{
      ...basePayment,
      linkedLoanId: 'loan-home',
      linkedLoanName: 'Home loan',
    }], { onDeletePayment, onNavigateToLoan })

    expect(screen.getByText('Linked to Home loan')).toBeTruthy()
    const linkedLoan = screen.getByRole('link', { name: 'View linked loan: Home loan' })
    expect(linkedLoan.getAttribute('href')).toBe('/recurring?loan=loan-home')
    fireEvent.click(linkedLoan)
    expect(onNavigateToLoan).toHaveBeenCalledWith('loan-home')

    const deleteButton = screen.getByRole('button', { name: 'Delete Netflix' }) as HTMLButtonElement
    expect(deleteButton.disabled).toBe(true)
    expect(deleteButton.title).toContain('Home loan')
    fireEvent.click(deleteButton)
    expect(onDeletePayment).not.toHaveBeenCalled()
  })
})

describe('RecurringBills highlight-on-navigation', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('scrolls the targeted card into view and clears the highlight afterwards', async () => {
    vi.useFakeTimers()
    const onClearHighlight = vi.fn()
    renderCards([basePayment], { highlightedId: 'rp-1', onClearHighlight })

    const card = document.getElementById('recur-card-rp-1')!
    await vi.advanceTimersByTimeAsync(350)
    expect(card.classList.contains('search-target-highlight')).toBe(true)

    await vi.advanceTimersByTimeAsync(2600)
    expect(onClearHighlight).toHaveBeenCalled()
    vi.useRealTimers()
  })
})

const occurrence = (overrides: Partial<ActiveRecurringPayment>): ActiveRecurringPayment => ({
  id: 'occ', recurringPaymentId: 'rp-1', name: 'Netflix', amount: 15, category: 'Entertainment',
  ledgerCategory: 'Essentials', dueDate: '2026-10-20', isPaid: false, isDiscarded: false, status: 'Pending',
  ...overrides,
})

describe('RecurringBills list', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('groups bills by what needs doing and opens the first one beside the list', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 9, 12) })
    const bills: RecurringPayment[] = [
      { ...basePayment, id: 'later', name: 'Gym', nextDueDate: '2026-10-25' },
      { ...basePayment, id: 'late', name: 'Power', nextDueDate: '2026-10-02' },
      { ...basePayment, id: 'soon', name: 'Phone', nextDueDate: '2026-10-11' },
      { ...basePayment, id: 'paid', name: 'Water', nextDueDate: '2026-11-05' },
      { ...basePayment, id: 'off', name: 'Old app', active: false },
    ]
    renderCards(bills, {
      occurrences: [
        occurrence({ id: 'o1', recurringPaymentId: 'late', dueDate: '2026-10-02' }),
        occurrence({ id: 'o2', recurringPaymentId: 'soon', dueDate: '2026-10-11' }),
        occurrence({ id: 'o3', recurringPaymentId: 'paid', dueDate: '2026-10-05', status: 'Paid', isPaid: true, paidDate: '2026-10-04' }),
      ],
    })

    const groups = screen.getAllByRole('region').map(region => region.getAttribute('aria-labelledby')).filter(Boolean)
    expect(groups).toEqual(['bill-group-overdue', 'bill-group-due-soon', 'bill-group-paid', 'bill-group-later', 'bill-group-paused'])
    expect(screen.getByText('7 days overdue')).toBeTruthy()
    expect(screen.getByText('Due in 2 days')).toBeTruthy()
    expect(screen.getByText(/Paid (Oct 4|4 Oct)/)).toBeTruthy()

    // The most urgent bill is the one open in the panel.
    expect(screen.getByRole('complementary', { name: 'Power details' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show details for Water' }))
    const detail = screen.getByRole('complementary', { name: 'Water details' })
    expect(within(detail).getByText('This cycle')).toBeTruthy()
    expect(within(detail).getByText('Paid on')).toBeTruthy()
    vi.useRealTimers()
  })

  it('lists only the bills due on a day picked from the strip', () => {
    const onClearDayFilter = vi.fn()
    renderCards([
      { ...basePayment, id: 'a', name: 'Gym' },
      { ...basePayment, id: 'b', name: 'Phone' },
    ], {
      occurrences: [
        occurrence({ id: 'o1', recurringPaymentId: 'a', dueDate: '2026-10-20' }),
        occurrence({ id: 'o2', recurringPaymentId: 'b', dueDate: '2026-10-22' }),
      ],
      dayFilter: '2026-10-22',
      onClearDayFilter,
    })

    expect(screen.queryByRole('button', { name: 'Show details for Gym' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show details for Phone' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Show all/ }))
    expect(onClearDayFilter).toHaveBeenCalled()
  })
})

describe('RecurringBills below the wide tier', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
    window.innerWidth = 1024
  })
  afterAll(() => { window.innerWidth = 1440 })

  it('opens a bill in a sheet instead of a side panel', () => {
    renderCards([basePayment])
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit Netflix' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show details for Netflix' }))
    const sheet = screen.getByRole('dialog', { name: 'Netflix' })
    expect(within(sheet).getByRole('button', { name: 'Edit Netflix' })).toBeTruthy()
    expect(within(sheet).getByText('Manual payment')).toBeTruthy()
  })
})
