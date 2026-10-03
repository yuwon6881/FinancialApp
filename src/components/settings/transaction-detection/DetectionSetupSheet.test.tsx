import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CaptureState } from '../../../lib/native/purchaseCapture'
import { purchaseCaptureStatus } from '../../../lib/native/purchaseCaptureStatus'
import { DetectionSetupSheet } from './DetectionSetupSheet'

const base: CaptureState = { enabled: true, packages: ['bank'], candidates: [], access: true, listenerConnected: true, notifications: true }

function renderSheet(state: CaptureState, onBatterySettings = vi.fn(), onReconnect = vi.fn(), onAccess = vi.fn()) {
  render(
    <DetectionSetupSheet
      isOpen
      onClose={vi.fn()}
      state={state}
      status={purchaseCaptureStatus(state)}
      busy={false}
      onChooseApps={vi.fn()}
      onAccess={onAccess}
      onNotificationSettings={vi.fn()}
      onBatterySettings={onBatterySettings}
      onReconnect={onReconnect}
    />,
  )
  return onBatterySettings
}

describe('DetectionSetupSheet battery step', () => {
  it('keeps completed setup separate from a stalled listener and offers recovery', () => {
    const reconnect = vi.fn(), access = vi.fn()
    renderSheet({ ...base, batteryUnrestricted: true, listenerConnected: false, listenerRecovery: 'stalled' }, vi.fn(), reconnect, access)
    expect(screen.getByRole('region', { name: 'Live detection connection' }).textContent).toContain('Not listening')
    expect(screen.getAllByText(/— Done/)).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }))
    expect(reconnect).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Reset notification access' }))
    expect(access).toHaveBeenCalledOnce()
  })

  it('does not offer reconnection when listening or notification access is missing', () => {
    const { unmount } = render(<DetectionSetupSheet isOpen onClose={vi.fn()} state={base} status={purchaseCaptureStatus(base)} busy={false} onChooseApps={vi.fn()} onAccess={vi.fn()} onNotificationSettings={vi.fn()} onBatterySettings={vi.fn()} onReconnect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Retry connection' })).toBeNull()
    unmount()
    renderSheet({ ...base, access: false, listenerConnected: false })
    expect(screen.queryByRole('button', { name: 'Retry connection' })).toBeNull()
  })
  it('stays hidden for Android shells that do not report battery state', () => {
    renderSheet(base)
    expect(screen.queryByText(/Keep detection running/)).toBeNull()
  })

  it('offers Unrestricted battery use as an optional step and opens App info', () => {
    const open = renderSheet({ ...base, batteryUnrestricted: false })
    expect(screen.getByText(/Keep detection running/).textContent).toContain('Optional')
    fireEvent.click(screen.getByRole('button', { name: 'Battery settings' }))
    expect(open).toHaveBeenCalledOnce()
  })

  it('marks the step done once battery use is Unrestricted', () => {
    renderSheet({ ...base, batteryUnrestricted: true })
    expect(screen.getByText(/Keep detection running/).textContent).toContain('Done')
    expect(screen.getByText(/Android may still disconnect detection/)).toBeTruthy()
  })
  it('keeps manual recovery available while automatic retries are scheduled', () => {
    renderSheet({ ...base, listenerConnected: false, listenerRecovery: 'stalled',
      listenerDiagnostics: { reconnectAttempts: 5, lastEvent: 'disconnected', lastFailure: '', recoveryScheduled: true } })
    expect(screen.getByRole('region', { name: 'Live detection connection' }).textContent).toContain('retry automatically')
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset notification access' })).toBeTruthy()
  })
})
