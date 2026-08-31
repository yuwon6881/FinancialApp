import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotificationsCard, type NotificationsCardProps } from './NotificationsCard'
import { otherDevicesHaveItOn } from '../../lib/push/messages'

vi.mock('./PushDevicesList', () => ({
  PushDevicesList: () => <div data-testid="push-devices" />,
}))

const renderCard = (overrides: Partial<NotificationsCardProps> = {}) => {
  const props: NotificationsCardProps = {
    pushSupported: true,
    pushLoading: false,
    pushBusyChannel: null,
    pushGuidance: null,
    billRemindersEnabled: false,
    categoryAlertsEnabled: false,
    otherDevicesBillReminders: false,
    otherDevicesCategoryAlerts: false,
    onToggleChannel: vi.fn(),
    enrolmentRevision: 0,
    hasSpendingGuides: true,
    ...overrides,
  }
  render(<NotificationsCard {...props} />)
  return props
}

const billsToggle = () => screen.getByRole('switch', { name: /^bill reminders$/i }) as HTMLButtonElement
const alertsToggle = () => screen.getByRole('switch', { name: /category spending alerts/i }) as HTMLButtonElement

describe('NotificationsCard', () => {
  it('offers each kind as its own switch, neither gated behind the other', () => {
    const props = renderCard()

    expect(billsToggle().disabled).toBe(false)
    expect(alertsToggle().disabled).toBe(false)

    fireEvent.click(alertsToggle())
    expect(props.onToggleChannel).toHaveBeenCalledWith('categoryAlerts', true)
    fireEvent.click(billsToggle())
    expect(props.onToggleChannel).toHaveBeenCalledWith('billReminders', true)
  })

  it('scopes every switch to this device, because that is all any of them changes', () => {
    renderCard()
    // "All devices" was the old account-wide spending-alert scope, and it was the claim a desktop
    // could not honour.
    expect(screen.getAllByText('This device').length).toBe(2)
    expect(screen.queryByText('All devices')).toBeNull()
  })

  it('reports another device opt-in as a sentence, never as this switch being on', () => {
    renderCard({ categoryAlertsEnabled: false, otherDevicesCategoryAlerts: true })

    expect(alertsToggle().getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText(otherDevicesHaveItOn('Spending alerts'))).toBeTruthy()
  })

  it('says nothing about other devices once this one is on', () => {
    renderCard({ categoryAlertsEnabled: true, otherDevicesCategoryAlerts: true })
    expect(screen.queryByText(otherDevicesHaveItOn('Spending alerts'))).toBeNull()
  })

  it('says when there is nothing for a spending alert to watch', () => {
    renderCard({ hasSpendingGuides: false })
    expect(screen.getByText(/not set a planned amount for any category/i)).toBeTruthy()
  })

  it('shows the busy state against the switch that is saving, not against both', () => {
    renderCard({ pushBusyChannel: 'categoryAlerts' })
    // The compact status lives inside the fixed-size switch, so it cannot take width from copy.
    expect(alertsToggle().querySelector('[data-mutation-status-slot]')).toBeTruthy()
    expect(billsToggle().querySelector('[data-mutation-status-slot]')).toBeTruthy()
    expect(alertsToggle().querySelector('[data-mutation-state="syncing"]')).toBeTruthy()
    expect(billsToggle().querySelector('[data-mutation-state="syncing"]')).toBeNull()
    expect(screen.getByTitle(/spending alerts/i)).toBeTruthy()
    expect(screen.queryByTitle(/bill reminders/i)).toBeNull()
    expect(alertsToggle().disabled).toBe(true)
  })

  it('disables both switches when the browser cannot support push at all', () => {
    renderCard({ pushSupported: false })
    expect(billsToggle().disabled).toBe(true)
    expect(alertsToggle().disabled).toBe(true)
  })
})
