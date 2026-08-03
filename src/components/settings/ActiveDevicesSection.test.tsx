import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionSummary } from '../../lib/api'
import { ActiveDevicesSection } from './ActiveDevicesSection'

const getSessions = vi.fn()
const revokeSession = vi.fn()
const revokeAllSessions = vi.fn()

vi.mock('../../lib/api', () => ({
  getSessions: () => getSessions(),
  revokeSession: (id: string) => revokeSession(id),
  revokeAllSessions: (includeCurrent: boolean) => revokeAllSessions(includeCurrent),
}))

vi.mock('../../contexts/AppContext', () => ({
  useAppPrefs: () => ({ hideSensitive: false }),
  useAppUi: () => ({ showToast: vi.fn() }),
}))

describe('ActiveDevicesSection', () => {
  beforeEach(() => {
    getSessions.mockReset()
    revokeSession.mockReset()
    revokeAllSessions.mockReset()
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

  it('shows a row-level state while revoking one device', async () => {
    const sessions: SessionSummary[] = [
      {
        id: 'session-current',
        deviceName: 'Current browser',
        createdAt: '2026-07-20T00:00:00Z',
        expiresAt: '2026-08-20T00:00:00Z',
        isLocked: false,
        lastActiveAt: '2026-07-20T00:00:00Z',
        ipAddress: null,
        userAgent: null,
        isCurrent: true,
      },
      {
        id: 'session-phone',
        deviceName: 'Pixel phone',
        createdAt: '2026-07-19T00:00:00Z',
        expiresAt: '2026-08-19T00:00:00Z',
        isLocked: false,
        lastActiveAt: '2026-07-19T00:00:00Z',
        ipAddress: null,
        userAgent: null,
        isCurrent: false,
      },
    ]
    getSessions.mockResolvedValue(sessions)
    let resolveRevoke!: () => void
    revokeSession.mockReturnValue(new Promise<void>(resolve => { resolveRevoke = resolve }))

    render(<ActiveDevicesSection />)
    await screen.findByText('2')
    fireEvent.click(screen.getByRole('button', { name: /Active Devices/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Pixel phone' }))

    expect(screen.getByText('Deleting…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Revoke Pixel phone' }).hasAttribute('disabled')).toBe(true)

    await act(async () => resolveRevoke())
    await waitFor(() => expect(screen.queryByText('Deleting…')).toBeNull())
  })

  it('shows a busy state while revoking all other devices', async () => {
    const sessions: SessionSummary[] = [
      {
        id: 'session-current',
        deviceName: 'Current browser',
        createdAt: '2026-07-20T00:00:00Z',
        expiresAt: '2026-08-20T00:00:00Z',
        isLocked: false,
        lastActiveAt: '2026-07-20T00:00:00Z',
        ipAddress: null,
        userAgent: null,
        isCurrent: true,
      },
      {
        id: 'session-phone',
        deviceName: 'Pixel phone',
        createdAt: '2026-07-19T00:00:00Z',
        expiresAt: '2026-08-19T00:00:00Z',
        isLocked: false,
        lastActiveAt: '2026-07-19T00:00:00Z',
        ipAddress: null,
        userAgent: null,
        isCurrent: false,
      },
    ]
    getSessions.mockResolvedValue(sessions)
    let resolveRevokeAll!: (value: { revokedCount: number }) => void
    revokeAllSessions.mockReturnValue(new Promise<{ revokedCount: number }>(resolve => { resolveRevokeAll = resolve }))

    render(<ActiveDevicesSection />)
    await screen.findByText('2')
    fireEvent.click(screen.getByRole('button', { name: /Active Devices/i }))

    const revokeAll = screen.getByRole('button', { name: 'Log out all other devices' })
    fireEvent.click(revokeAll)

    expect(screen.getByRole('button', { name: /Revoking/i }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Deleting…')).toBeTruthy()

    await act(async () => resolveRevokeAll({ revokedCount: 1 }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Revoking/i })).toBeNull())
  })
})
