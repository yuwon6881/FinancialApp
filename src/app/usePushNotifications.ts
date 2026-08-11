import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import type { PushChannel, PushStatus } from '../types'

// Which control is mid-flight. The two switches used to share one `busy` flag, so acting on either
// greyed out both and neither could report its own state.
export type PushBusyAction = PushChannel | null

export interface UsePushNotificationsResult {
  supported: boolean
  loading: boolean
  busy: boolean
  busyAction: PushBusyAction
  /** What THIS device receives. Both switches render from these two, and nothing else. */
  billRemindersEnabled: boolean
  categoryAlertsEnabled: boolean
  /** Whether some *other* device receives it. Informational copy only — never a switch state. */
  otherDevicesBillReminders: boolean
  otherDevicesCategoryAlerts: boolean
  /**
   * Rises once every time an enrolment write has been **confirmed by the server**, and is what the
   * devices roster re-reads on.
   *
   * It must not be derived from the switch booleans. Those flip optimistically, so a roster keyed
   * on them fired its `GET /push/devices` while the `PUT` was still in flight — the read returned
   * the pre-write roster, and because the key had already reached its final value nothing ever
   * re-read it. Turning on bill reminders and then spending alerts left the roster saying "Bill
   * reminders" until a reload.
   */
  enrolmentRevision: number
  guidance: string | null
  setChannelEnabled: (channel: PushChannel, enabled: boolean) => Promise<boolean>
  refresh: () => Promise<PushStatus | null>
}

const EMPTY_STATUS: PushStatus = {
  enabled: false,
  deviceRegistered: false,
  billRemindersEnabled: false,
  categoryAlertsEnabled: false,
  otherDevicesBillReminders: false,
  otherDevicesCategoryAlerts: false,
}

let pushModulePromise: Promise<typeof import('../lib/push')> | null = null
function loadPushModule() {
  if (!pushModulePromise) {
    pushModulePromise = import('../lib/push')
  }
  return pushModulePromise
}

function channelOf(status: PushStatus, channel: PushChannel): boolean {
  return channel === 'billReminders' ? status.billRemindersEnabled : status.categoryAlertsEnabled
}

export function usePushNotifications(
  active = true,
  onForegroundNotification?: (message: string, title?: string) => void,
  /** The signed-in account, so this browser's opt-in record cannot be read across accounts. */
  account?: string | null,
): UsePushNotificationsResult {
  const [supported, setSupported] = useState(true)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<PushBusyAction>(null)
  const [guidance, setGuidance] = useState<string | null>(null)
  const [enrolmentRevision, setEnrolmentRevision] = useState(0)

  // Called only once the server has answered a write, never beside the optimistic flip.
  const markEnrolmentChanged = useCallback(() => setEnrolmentRevision(current => current + 1), [])

  const refreshInternal = useCallback(async (pushModule: typeof import('../lib/push'), devId: string | null) => {
    if (!active || !pushModule.isPushSupported() || !devId) {
      setLoading(false)
      return null
    }
    try {
      const next = await api.fetchPushStatus(devId)
      setStatus(next)
      return next
    } catch (err) {
      console.error('Could not fetch push notification status.', err)
    } finally {
      setLoading(false)
    }
    return null
  }, [active])

  const refresh = useCallback(async () => {
    if (!active) {
      setLoading(false)
      return null
    }
    const push = await loadPushModule()
    const devId = deviceId || (push.isPushSupported() ? push.getOrCreateDeviceId() : null)
    if (devId && !deviceId) setDeviceId(devId)
    return refreshInternal(push, devId)
  }, [active, deviceId, refreshInternal])

  useEffect(() => {
    if (!active) {
      setStatus(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void loadPushModule().then(async push => {
      if (cancelled) return
      const isSupp = push.isPushSupported()
      setSupported(isSupp)
      if (!isSupp) {
        setGuidance(push.PUSH_UNSUPPORTED_GUIDANCE)
        setLoading(false)
        return
      }
      const devId = push.getOrCreateDeviceId()
      setDeviceId(devId)
      const next = await refreshInternal(push, devId)
      if (cancelled || !next) return

      const intent = push.readPushChannelIntent(account)
      if (next.deviceRegistered) {
        // Keep the repair record equal to what the server just said. Without this, an install that
        // enrolled before this record existed would have nothing to repair from the first time it
        // needed to.
        push.writePushChannelIntent(account, {
          billReminders: next.billRemindersEnabled,
          categoryAlerts: next.categoryAlertsEnabled,
        })
      } else if (!push.hasPushChannelIntent(intent)) {
        // Not registered and never opted in here: nothing to refresh and nothing to repair.
        return
      }

      // The server records the enrolment, but only the browser knows whether it is still allowed
      // to show a notification. Revoking permission from browser settings leaves the row enabled,
      // so the switch read "on" while nothing could arrive, and the dispatcher kept sending to a
      // device that would never display them. Drop the enrolment and say why, rather than showing
      // a switch that lies.
      if (Notification.permission !== 'granted') {
        if (!next.deviceRegistered) {
          // Nothing to release; the local record is stale and would otherwise keep asking to
          // re-enrol on every launch of a browser that has since blocked notifications.
          push.writePushChannelIntent(account, { billReminders: false, categoryAlerts: false })
          if (!cancelled) setGuidance(push.PUSH_PERMISSION_REVOKED_GUIDANCE)
          return
        }
        try {
          await api.deletePushSubscription(devId)
          push.writePushChannelIntent(account, { billReminders: false, categoryAlerts: false })
          if (cancelled) return
          await refreshInternal(push, devId)
          markEnrolmentChanged()
        } catch (err) {
          console.warn('Could not release this device after notification permission was revoked.', err)
        }
        if (!cancelled) setGuidance(push.PUSH_PERMISSION_REVOKED_GUIDANCE)
        return
      }

      try {
        const registration = await navigator.serviceWorker.ready
        const token = await push.getFcmToken(registration)
        if (!token) return
        // Two jobs in one call. For a device the server still lists, this refreshes a token that
        // may have rotated. For a device it does not — an install whose row was disabled by the
        // old sign-out behaviour — this is the repair: re-register the kinds this browser recorded
        // for this account, rather than making the user re-tap a switch they never turned off.
        const channels = next.deviceRegistered
          ? undefined
          : { billReminders: intent.billReminders, categoryAlerts: intent.categoryAlerts }
        await api.upsertPushSubscription(devId, token, channels)
        if (!next.deviceRegistered && !cancelled) {
          // A repair changed the roster; a plain token refresh did not.
          await refreshInternal(push, devId)
          markEnrolmentChanged()
        }
      } catch (err) {
        console.warn('Could not refresh this device push token.', err)
      }
    })
    return () => {
      cancelled = true
    }
  }, [active, account, markEnrolmentChanged, refreshInternal])

  useEffect(() => {
    if (!active || !onForegroundNotification || !status?.deviceRegistered || Notification.permission !== 'granted') return
    let disposed = false
    let unsubscribe: (() => void) | undefined
    void loadPushModule().then(push => {
      if (disposed || !push.isPushSupported()) return
      return push.onForegroundMessage(payload => {
        const title = payload.data?.title || payload.notification?.title || 'FinancialApp notification'
        const message = payload.data?.body || payload.notification?.body || 'Open the app to review this update.'
        onForegroundNotification(message, title)
      })
      .then(cleanup => {
        if (disposed) cleanup()
        else unsubscribe = cleanup
      })
      .catch(err => console.warn('Could not start foreground push handling.', err))
    })
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [active, onForegroundNotification, status?.deviceRegistered])

  /**
   * Turns one kind on or off for this device.
   *
   * Enabling runs the strict order permission -> service worker ready -> FCM token -> backend
   * upsert, and any step failing or being denied stops without flipping the visual state. Only
   * this channel is sent, so the other one is left exactly as the user left it.
   */
  const setChannelEnabled = useCallback(async (channel: PushChannel, enabled: boolean): Promise<boolean> => {
    const push = await loadPushModule()
    if (!push.isPushSupported() || !deviceId) {
      setGuidance(push.PUSH_UNSUPPORTED_GUIDANCE)
      return false
    }
    const previousStatus = status
    setBusyAction(channel)
    setGuidance(null)

    const rememberIntent = (value: boolean) => {
      push.writePushChannelIntent(
        account,
        push.withChannel(push.readPushChannelIntent(account), channel, value),
      )
    }

    try {
      if (!enabled) {
        setStatus(current => (current
          ? {
            ...current,
            billRemindersEnabled: channel === 'billReminders' ? false : current.billRemindersEnabled,
            categoryAlertsEnabled: channel === 'categoryAlerts' ? false : current.categoryAlertsEnabled,
          }
          : current))
        rememberIntent(false)
        await api.disablePushChannel(deviceId, channel)
        await refreshInternal(push, deviceId)
        markEnrolmentChanged()
        return true
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setGuidance(push.PUSH_DENIED_GUIDANCE)
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const token = await push.getFcmToken(registration)
      if (!token) {
        setGuidance(push.PUSH_UNSUPPORTED_GUIDANCE)
        return false
      }

      // Permission/token acquisition can require browser UI, but once those succeed the switch
      // should react immediately. Reconcile with the server afterward and roll back on failure.
      setStatus(current => ({
        ...(current ?? EMPTY_STATUS),
        enabled: true,
        deviceRegistered: true,
        billRemindersEnabled: channel === 'billReminders' ? true : !!current?.billRemindersEnabled,
        categoryAlertsEnabled: channel === 'categoryAlerts' ? true : !!current?.categoryAlertsEnabled,
      }))
      await api.upsertPushSubscription(deviceId, token, { [channel]: true })
      rememberIntent(true)
      await refreshInternal(push, deviceId)
      // Only now, with the write acknowledged: the roster reads from the server, so signalling it
      // beside the optimistic flip above raced the PUT and returned the pre-write list.
      markEnrolmentChanged()
      return true
    } catch (err) {
      console.error('Could not update notifications for this device.', err)
      setStatus(previousStatus)
      // Put the local record back to whatever the server last told us, so a failed write cannot
      // leave this browser trying to re-register something it never managed to turn on.
      rememberIntent(!!previousStatus && channelOf(previousStatus, channel))
      setGuidance(getErrorMessage(err, enabled
        ? push.PUSH_UNSUPPORTED_GUIDANCE
        : 'These notifications could not be turned off. Please try again.'))
      return false
    } finally {
      setBusyAction(null)
    }
  }, [account, deviceId, markEnrolmentChanged, refreshInternal, status])

  return {
    supported,
    loading,
    busy: busyAction !== null,
    busyAction,
    billRemindersEnabled: !!status?.billRemindersEnabled,
    categoryAlertsEnabled: !!status?.categoryAlertsEnabled,
    otherDevicesBillReminders: !!status?.otherDevicesBillReminders,
    otherDevicesCategoryAlerts: !!status?.otherDevicesCategoryAlerts,
    enrolmentRevision,
    guidance,
    setChannelEnabled,
    refresh,
  }
}
