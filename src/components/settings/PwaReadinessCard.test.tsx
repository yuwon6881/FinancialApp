import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPwaExperienceValue, publishPwaExperience } from '../../app/pwaExperienceContext'
import { PwaReadinessCard } from './PwaReadinessCard'

const { countStoredScanUploads } = vi.hoisted(() => ({
  countStoredScanUploads: vi.fn<(ownerId?: string) => Promise<number | null>>(),
}))

vi.mock('../../lib/scanUploadStore', () => ({
  countStoredScanUploads,
  PENDING_SCAN_UPLOADS_CHANGED_EVENT: 'financialapp:pending-scan-uploads-changed',
}))

const SCAN_UPLOADS_CHANGED = 'financialapp:pending-scan-uploads-changed'
const retryOfflineSetup = vi.fn<() => Promise<void>>()

describe('PwaReadinessCard', () => {
  beforeEach(() => {
    countStoredScanUploads.mockReset()
    localStorage.setItem('auth_username', 'alice')
    countStoredScanUploads.mockResolvedValue(0)
    retryOfflineSetup.mockReset()
    act(() => publishPwaExperience({
      ...getPwaExperienceValue(),
      offlineSetupError: null,
      offlineSetupRetryBusy: false,
      retryOfflineSetup,
    }))
  })

  it('reports retained scan images and replaces the all-clear when the queue changes', async () => {
    countStoredScanUploads
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)

    render(<PwaReadinessCard unsyncedChangeCount={0} draftCount={0} ownerId="alice" />)
    await screen.findByText('No changes waiting to sync')
    expect(countStoredScanUploads).toHaveBeenCalledWith('alice')

    await act(async () => {
      window.dispatchEvent(new Event(SCAN_UPLOADS_CHANGED))
    })

    await waitFor(() => expect(screen.getByText(/2 saved scan images on this device, waiting to upload or review/i)).toBeTruthy())
    expect(screen.queryByText('No changes waiting to sync')).toBeNull()
  })

  it('does not claim an all-clear when saved upload state cannot be read', async () => {
    countStoredScanUploads.mockResolvedValue(null)

    render(<PwaReadinessCard unsyncedChangeCount={0} draftCount={0} ownerId="alice" />)

    await waitFor(() => expect(screen.getByText('Saved upload status could not be checked')).toBeTruthy())
    expect(screen.queryByText('No changes waiting to sync')).toBeNull()
  })

  it('recounts only the newly active account when the authenticated account changes', async () => {
    countStoredScanUploads.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
    const { rerender } = render(<PwaReadinessCard unsyncedChangeCount={0} draftCount={0} ownerId="alice" />)
    await screen.findByText(/2 saved scan images on this device/i)

    rerender(<PwaReadinessCard unsyncedChangeCount={0} draftCount={0} ownerId="bob" />)

    await screen.findByText('No changes waiting to sync')
    expect(countStoredScanUploads).toHaveBeenLastCalledWith('bob')
  })

  it('shows service-worker setup failures and lets the user retry', async () => {
    act(() => publishPwaExperience({
      ...getPwaExperienceValue(),
      offlineSetupError: 'Offline support could not be set up. Check your connection and try again.',
    }))

    render(<PwaReadinessCard unsyncedChangeCount={0} draftCount={0} ownerId="alice" />)

    expect(screen.getByText('Offline setup needs attention')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/offline support could not be set up/i)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry offline setup' }))
    })
    expect(retryOfflineSetup).toHaveBeenCalledOnce()
  })
})
