import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsePushNotificationsResult } from './usePushNotifications'

const native = vi.hoisted(() => ({
  camera: 'prompt' as string,
  notifications: 'prompt' as string,
  requestCamera: vi.fn(),
}))

vi.mock('@capacitor/core', async importOriginal => ({
  ...await importOriginal<typeof import('@capacitor/core')>(),
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true },
}))
vi.mock('@capacitor/camera', () => ({
  Camera: {
    checkPermissions: async () => ({ camera: native.camera }),
    requestPermissions: async () => { native.requestCamera(); native.camera = 'granted'; return { camera: 'granted' } },
  },
}))
vi.mock('../lib/push/nativeMessaging', () => ({ checkNativePushPermission: async () => native.notifications }))
vi.mock('@capacitor/app', () => ({ App: { addListener: async () => ({ remove: async () => undefined }) } }))

import PermissionSetupHost from './PermissionSetupHost'

function pushResult(setChannelEnabled = vi.fn(async () => true)): UsePushNotificationsResult {
  return {
    supported: true, loading: false, busy: false, busyAction: null,
    billRemindersEnabled: false, categoryAlertsEnabled: false,
    otherDevicesBillReminders: false, otherDevicesCategoryAlerts: false,
    enrolmentRevision: 0, guidance: null, setChannelEnabled, refresh: async () => null,
  }
}

function renderHost(props: Partial<Parameters<typeof PermissionSetupHost>[0]> = {}) {
  return render(
    <PermissionSetupHost
      requested={false}
      onRequestClosed={vi.fn()}
      ready
      push={pushResult()}
      hidden={false}
      onReveal={vi.fn()}
      {...props}
    />,
  )
}

describe('PermissionSetupHost', () => {
  beforeEach(() => {
    native.camera = 'prompt'
    native.notifications = 'prompt'
    native.requestCamera.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('offers itself once, unprompted, after the app is ready, and never again after it is closed', async () => {
    vi.useFakeTimers()
    const { unmount } = renderHost({ ready: false })
    await act(async () => { vi.advanceTimersByTime(5_000) })
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()

    const view = renderHost()
    await act(async () => { vi.advanceTimersByTime(1_000) })
    vi.useRealTimers()
    const dialog = await screen.findByRole('dialog', { name: 'App permissions' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Not now' }))
    expect(localStorage.getItem('financialapp.permissionSetup.v1')).toBe('skipped')
    view.unmount()

    vi.useFakeTimers()
    renderHost()
    await act(async () => { vi.advanceTimersByTime(5_000) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('allows notifications and the camera in one press, enrolling this phone for both kinds', async () => {
    const setChannelEnabled = vi.fn(async () => true)
    renderHost({ requested: true, ready: false, push: pushResult(setChannelEnabled) })
    const dialog = await screen.findByRole('dialog', { name: 'App permissions' })
    await waitFor(() => expect(within(dialog).getByRole('listitem', { name: 'Camera' }).textContent).toContain('Not allowed'))
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Allow all' }))
    await waitFor(() => expect(native.requestCamera).toHaveBeenCalledOnce())
    expect(setChannelEnabled).toHaveBeenNthCalledWith(1, 'billReminders', true)
    expect(setChannelEnabled).toHaveBeenNthCalledWith(2, 'categoryAlerts', true)
    await waitFor(() => expect(within(dialog).getByRole('listitem', { name: 'Camera' }).textContent).toContain('Allowed'))
  })

  it('sends a refused permission to system settings instead of asking again', async () => {
    native.notifications = 'denied'
    renderHost({ requested: true, ready: false })
    const dialog = await screen.findByRole('dialog', { name: 'App permissions' })
    const row = await within(dialog).findByRole('listitem', { name: 'Notifications' })
    await waitFor(() => expect(row.textContent).toContain('Blocked'))
    expect(within(row).getByRole('button', { name: 'Open settings: Notifications' })).toBeTruthy()
  })
})
