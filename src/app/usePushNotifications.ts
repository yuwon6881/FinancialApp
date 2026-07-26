import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { PushStatus } from '../types'
import { getOrCreateDeviceId } from '../lib/push/deviceId'
import { isPushSupported } from '../lib/push/support'
import { getFcmToken, onForegroundMessage } from '../lib/push/firebaseMessaging'
import { PUSH_DENIED_GUIDANCE, PUSH_ENABLED_ELSEWHERE_MESSAGE, PUSH_UNSUPPORTED_GUIDANCE } from '../lib/push/messages'

export interface UsePushNotificationsResult {
  supported: boolean
  loading: boolean
  busy: boolean
  // Visually "enabled" only once the global setting is on AND this specific device is
  // registered -- an in-flight enable (or a global toggle flipped on from another device)
  // must never flash this device's control into the "on" state.
  enabled: boolean
  accountEnabled: boolean
  deviceRegistered: boolean
  guidance: string | null
  enable: () => Promise<boolean>
  disable: () => Promise<void>
  refresh: () => Promise<PushStatus | null>
}

export function usePushNotifications(
  active = true,
  onForegroundNotification?: (message: string, title?: string) => void,
): UsePushNotificationsResult {
  const [supported] = useState(() => isPushSupported())
  const [deviceId] = useState(() => (isPushSupported() ? getOrCreateDeviceId() : null))
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [guidance, setGuidance] = useState<string | null>(supported ? null : PUSH_UNSUPPORTED_GUIDANCE)

  const refresh = useCallback(async () => {
    if (!active || !supported || !deviceId) {
      setLoading(false)
      return null
    }
    try {
      const next = await api.fetchPushStatus(deviceId)
      setStatus(next)
      setGuidance(next.enabled && !next.deviceRegistered ? PUSH_ENABLED_ELSEWHERE_MESSAGE : null)
      return next
    } catch (err) {
      console.error('Could not fetch push notification status.', err)
    } finally {
      setLoading(false)
    }
    return null
  }, [active, supported, deviceId])

  useEffect(() => {
    if (!active) {
      setStatus(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh().then(async next => {
      if (!next?.enabled || !next.deviceRegistered || Notification.permission !== 'granted') return
      try {
        const registration = await navigator.serviceWorker.ready
        const token = await getFcmToken(registration)
        if (token && deviceId) await api.upsertPushSubscription(deviceId, token)
      } catch (err) {
        console.warn('Could not refresh this device push token.', err)
      }
    })
  }, [active, deviceId, refresh])

  useEffect(() => {
    if (!active || !supported || !onForegroundNotification) return
    let disposed = false
    let unsubscribe: (() => void) | undefined
    void onForegroundMessage(payload => {
        const title = payload.data?.title || payload.notification?.title || 'Payment reminder'
        const message = payload.data?.body || payload.notification?.body || 'A recurring payment is approaching.'
        onForegroundNotification(message, title)
      })
      .then(cleanup => {
        if (disposed) cleanup()
        else unsubscribe = cleanup
      })
      .catch(err => console.warn('Could not start foreground push handling.', err))
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [active, supported, onForegroundNotification])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported || !deviceId) {
      setGuidance(PUSH_UNSUPPORTED_GUIDANCE)
      return false
    }
    const previousStatus = status
    setBusy(true)
    setGuidance(null)
    try {
      // Strict order: permission -> service worker ready -> FCM token/backend upsert ->
      // global backend enable. Any step failing/denying stops here without flipping the
      // visual state, matching "not enabled until every step succeeds".
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setGuidance(PUSH_DENIED_GUIDANCE)
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const token = await getFcmToken(registration)
      if (!token) {
        setGuidance(PUSH_UNSUPPORTED_GUIDANCE)
        return false
      }

      // Permission/token acquisition can require browser UI, but once those succeed the switch
      // should react immediately. Reconcile with the server afterward and roll back on failure.
      setStatus({ enabled: true, deviceRegistered: true })
      await api.upsertPushSubscription(deviceId, token)
      await refresh()
      return true
    } catch (err) {
      console.error('Could not enable push notifications.', err)
      setStatus(previousStatus)
      setGuidance(PUSH_UNSUPPORTED_GUIDANCE)
      return false
    } finally {
      setBusy(false)
    }
  }, [supported, deviceId, refresh, status])

  const disable = useCallback(async () => {
    if (!supported || !deviceId) return
    const previousStatus = status
    setBusy(true)
    // We know this device is turning off immediately, but we do not yet know whether it is the
    // account's last device. Preserve the account state until the server returns the authoritative
    // multi-device result so recurring-payment cards never flash a false "Paused" state.
    setStatus({
      enabled: previousStatus?.enabled ?? false,
      deviceRegistered: false,
    })
    setGuidance(null)
    try {
      // Push opt-in is per device. Removing this subscription leaves every other device alone;
      // the server clears the account gate only when this was the last enabled device.
      await api.deletePushSubscription(deviceId)
      await refresh()
    } catch (err) {
      console.error('Could not disable push notifications.', err)
      setStatus(previousStatus)
      setGuidance(previousStatus?.enabled && !previousStatus.deviceRegistered
        ? PUSH_ENABLED_ELSEWHERE_MESSAGE
        : null)
    } finally {
      setBusy(false)
    }
  }, [supported, deviceId, refresh, status])

  return {
    supported,
    loading,
    busy,
    enabled: !!status?.enabled && !!status?.deviceRegistered,
    accountEnabled: !!status?.enabled,
    deviceRegistered: !!status?.deviceRegistered,
    guidance,
    enable,
    disable,
    refresh,
  }
}
