import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotificationsCard, type NotificationsCardProps } from './NotificationsCard'
import { CATEGORY_ALERTS_NEED_DEVICE } from '../../lib/push/messages'

vi.mock('./PushDevicesList', () => ({
  PushDevicesList: () => <div data-testid="push-devices" />,
}))

const renderCard = (overrides: Partial<NotificationsCardProps> = {}) => {
  const props: NotificationsCardProps = {
    notifyOnLoginEnabled: true,
    onToggleNotifyOnLogin: vi.fn(),
    pushEnabled: true,
    pushSupported: true,
    pushLoading: false,
    deviceBusy: false,
    categoryAlertsBusy: false,
    pushGuidance: null,
    onTogglePushEnabled: vi.fn(),
    categoryAlertsEnabled: false,
    onToggleCategoryAlerts: vi.fn(),
    hasSpendingGuides: true,
    ...overrides,
  }
  render(<NotificationsCard {...props} />)
  return props
}

const deviceToggle = () => screen.getByRole('switch', { name: /notifications on this device/i }) as HTMLButtonElement
const alertsToggle = () => screen.getByRole('switch', { name: /category spending alerts/i }) as HTMLButtonElement

describe('NotificationsCard', () => {
  it('states the scope of every switch, because they are not all the same', () => {
    renderCard()
    expect(screen.getAllByText('This device').length).toBeGreaterThan(0)
    expect(screen.getByText('All devices')).toBeTruthy()
  })

  it('blocks category alerts with a reason instead of silently enabling this device', () => {
    const props = renderCard({ pushEnabled: false, categoryAlertsEnabled: false })

    expect(alertsToggle().disabled).toBe(true)
    expect(screen.getByText(CATEGORY_ALERTS_NEED_DEVICE)).toBeTruthy()
    fireEvent.click(alertsToggle())
    expect(props.onToggleCategoryAlerts).not.toHaveBeenCalled()
    // It used to enable this device first, raising a browser permission prompt from a switch
    // that never mentioned devices or permission.
    expect(props.onTogglePushEnabled).not.toHaveBeenCalled()
  })

  it('says when there is nothing for a spending alert to watch', () => {
    renderCard({ hasSpendingGuides: false })
    expect(screen.getByText(/not set a planned amount for any category/i)).toBeTruthy()
  })

  it('shows the busy state against the row that is saving, not against both', () => {
    renderCard({ categoryAlertsBusy: true })
    // RowSyncStatus names the entity it reports on, so only one row can claim to be busy.
    expect(screen.getByTitle(/spending alerts/i)).toBeTruthy()
    expect(screen.queryByTitle(/device notifications/i)).toBeNull()
    expect(alertsToggle().disabled).toBe(true)
  })

  it('disables both switches when the browser cannot support push at all', () => {
    renderCard({ pushSupported: false })
    expect(deviceToggle().disabled).toBe(true)
    expect(alertsToggle().disabled).toBe(true)
    // The "turn the device on first" nudge would be a dead end here: it cannot be turned on.
    expect(screen.queryByText(CATEGORY_ALERTS_NEED_DEVICE)).toBeNull()
  })
})
