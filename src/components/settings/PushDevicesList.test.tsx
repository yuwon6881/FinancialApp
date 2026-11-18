import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PushDevice } from '../../types'
import { PushDevicesList } from './PushDevicesList'

const fetchPushDevices = vi.fn()
const revokePushDevice = vi.fn()

vi.mock('../../lib/api', () => ({
  fetchPushDevices: (deviceId: string, signal?: AbortSignal) => fetchPushDevices(deviceId, signal),
  revokePushDevice: (id: string) => revokePushDevice(id),
}))

vi.mock('../../lib/push/deviceId', () => ({ getExistingDeviceId: () => 'this-device' }))

vi.mock('../../contexts/AppContext', () => ({
  useAppUi: () => ({ showToast: vi.fn() }),
}))

const other = {
  id: 'other',
  isCurrent: false,
  billRemindersEnabled: true,
  categoryAlertsEnabled: false,
  enrolledAt: '2026-07-01T00:00:00Z',
} as PushDevice

describe('PushDevicesList', () => {
  it('asks for the push status to be re-read after revoking another device', async () => {
    fetchPushDevices.mockResolvedValueOnce([other]).mockResolvedValueOnce([])
    revokePushDevice.mockResolvedValue(undefined)
    const onRevoked = vi.fn()

    render(<PushDevicesList refreshKey={0} onRevoked={onRevoked} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop notifications for this other device' }))

    await waitFor(() => expect(onRevoked).toHaveBeenCalledOnce())
    await screen.findByText(/No device is set up/)
  })

  it('leaves the push status alone when the revoke fails', async () => {
    fetchPushDevices.mockResolvedValue([other])
    revokePushDevice.mockRejectedValue(new Error('nope'))
    const onRevoked = vi.fn()

    render(<PushDevicesList refreshKey={0} onRevoked={onRevoked} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Stop notifications for this other device' }))

    await waitFor(() => expect(revokePushDevice).toHaveBeenCalled())
    expect(onRevoked).not.toHaveBeenCalled()
  })
})
