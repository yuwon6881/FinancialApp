import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { RecurringPaymentCards } from './RecurringPaymentCards'
import { RECURRING_PAUSED_LABEL } from '../../lib/push/messages'
import type { RecurringPayment } from '../../types'

const basePayment: RecurringPayment = {
  id: 'rp-1',
  name: 'Netflix',
  amount: -15,
  frequency: 'Monthly',
  category: 'Entertainment',
  ledgerCategory: 'Essentials',
  nextDueDate: '2099-01-20',
  dueDate: 20,
  startDate: '2026-01-20',
  active: true,
  paymentMode: 'Manual',
}

const noop = () => {}

function renderCards(payments: RecurringPayment[], overrides: Partial<React.ComponentProps<typeof RecurringPaymentCards>> = {}) {
  return render(
    <RecurringPaymentCards
      payments={payments}
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

describe('RecurringPaymentCards reminder controls', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('starts a never-configured payment with the reminder off and no visible editor', () => {
    renderCards([basePayment])
    const toggle = screen.getByRole('switch', { name: 'Turn on payment reminder for Netflix' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('radiogroup', { name: 'Reminder frequency for Netflix' })).toBeNull()
  })

  it('enables the reminder with default Once/3-day settings when saved', () => {
    const onUpdateReminder = vi.fn()
    renderCards([basePayment], { onUpdateReminder })
    fireEvent.click(screen.getByRole('switch', { name: 'Turn on payment reminder for Netflix' }))
    expect(screen.getByRole('button', { name: 'Save Reminder' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save Reminder' }))
    expect(onUpdateReminder).toHaveBeenCalledWith('rp-1', { enabled: true, mode: 'Once', leadDays: 3 })
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
})

describe('RecurringPaymentCards pay early', () => {
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

describe('RecurringPaymentCards payment mode', () => {
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

describe('RecurringPaymentCards loan links', () => {
  it('identifies the linked loan and keeps delete visible but disabled', () => {
    const onDeletePayment = vi.fn()
    renderCards([{
      ...basePayment,
      linkedLoanId: 'loan-home',
      linkedLoanName: 'Home loan',
    }], { onDeletePayment })

    expect(screen.getByText('Linked to loan')).toBeTruthy()
    expect(screen.getByText('Home loan')).toBeTruthy()
    const deleteButton = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement
    expect(deleteButton.disabled).toBe(true)
    expect(deleteButton.title).toContain('Home loan')
    fireEvent.click(deleteButton)
    expect(onDeletePayment).not.toHaveBeenCalled()
  })
})

describe('RecurringPaymentCards highlight-on-navigation', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('scrolls the targeted card into view and clears the highlight afterwards', async () => {
    vi.useFakeTimers()
    const onClearHighlight = vi.fn()
    renderCards([basePayment], { highlightedId: 'rp-1', onClearHighlight })

    const card = document.getElementById('recur-card-rp-1')!
    await vi.advanceTimersByTimeAsync(350)
    expect(card.classList.contains('ring-2')).toBe(true)

    await vi.advanceTimersByTimeAsync(2600)
    expect(onClearHighlight).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
