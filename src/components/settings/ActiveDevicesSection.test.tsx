import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionSummary } from '../../lib/api'
import { ActiveDevicesSection } from './ActiveDevicesSection'

const getSessions = vi.fn()

vi.mock('../../lib/api', () => ({
  getSessions: () => getSessions(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}))

vi.mock('../../contexts/AppContext', () => ({
  useAppContext: () => ({
    hideSensitive: false,
    showToast: vi.fn(),
  }),
}))

describe('ActiveDevicesSection', () => {
  beforeEach(() => {
    getSessions.mockReset()
  })

  it('indicates that active devices are being fetched', async () => {
    let resolveSessions!: (sessions: SessionSummary[]) => void
    getSessions.mockReturnValue(new Promise<SessionSummary[]>(resolve => {
      resolveSessions = resolve
    }))

    render(<ActiveDevicesSection />)

    expect(screen.getByText('Checking…')).toBeTruthy()

    await act(async () => {
      resolveSessions([{
        id: 'session-1',
        deviceName: 'Pixel phone',
        createdAt: '2026-07-20T00:00:00Z',
        expiresAt: '2026-08-20T00:00:00Z',
        isLocked: false,
        lastActiveAt: '2026-07-20T00:00:00Z',
        ipAddress: null,
        userAgent: null,
        isCurrent: true,
      }])
    })

    await waitFor(() => expect(screen.queryByText('Checking…')).toBeNull())
    expect(screen.getByText('1')).toBeTruthy()
  })
})
