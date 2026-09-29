import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CaptureState } from '../../../lib/native/purchaseCapture'
import { purchaseCaptureStatus } from '../../../lib/native/purchaseCaptureStatus'
import { DetectionSetupSheet } from './DetectionSetupSheet'

const base: CaptureState = { enabled: true, packages: ['bank'], candidates: [], access: true, listenerConnected: true, notifications: true }

function renderSheet(state: CaptureState, onBatterySettings = vi.fn()) {
  render(
    <DetectionSetupSheet
      isOpen
      onClose={vi.fn()}
      state={state}
      status={purchaseCaptureStatus(state)}
      busy={false}
      onChooseApps={vi.fn()}
      onAccess={vi.fn()}
      onNotificationSettings={vi.fn()}
      onBatterySettings={onBatterySettings}
    />,
  )
  return onBatterySettings
}

describe('DetectionSetupSheet battery step', () => {
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
  })
})
