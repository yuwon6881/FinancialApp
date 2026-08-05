import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { PushStatus } from '../types'

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

let pushModulePromise: Promise<typeof import('../lib/push')> | null = null
function loadPushModule() {
  if (!pushModulePromise) {
    pushModulePromise = import('../lib/push')
  }
  return pushModulePromise
}

export function usePushNotifications(
  active = true,
  onForegroundNotification?: (message: string, title?: string) => void,
): UsePushNotificationsResult {
  const [supported, setSupported] = useState(true)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [guidance, setGuidance] = useState<string | null>(null)

  const refreshInternal = useCallback(async (pushModule: typeof import('../lib/push'), devId: string | null) => {
    if (!active || !pushModule.isPushSupported() || !devId) {
      setLoading(false)
      return null
    }
    try {
      const next = await api.fetchPushStatus(devId)
      setStatus(next)
      setGuidance(next.enabled && !next.deviceRegistered ? pushModule.PUSH_ENABLED_ELSEWHERE_MESSAGE : null)
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
      if (cancelled) return
      if (!next?.enabled || !next.deviceRegistered || Notification.permission !== 'granted') return
      try {
        const registration = await navigator.serviceWorker.ready
        const token = await push.getFcmToken(registration)
        if (token && devId) await api.upsertPushSubscription(devId, token)
      } catch (err) {
        console.warn('Could not refresh this device push token.', err)
      }
    })
    return () => {
      cancelled = true
    }
  }, [active, refreshInternal])

  useEffect(() => {
    if (!active || !onForegroundNotification) return
    let disposed = false
    let unsubscribe: (() => void) | undefined
    void loadPushModule().then(push => {
      if (disposed || !push.isPushSupported()) return
      return push.onForegroundMessage(payload => {
        const title = payload.data?.title || payload.notification?.title || 'Payment reminder'
        const message = payload.data?.body || payload.notification?.body || 'A recurring payment is approaching.'
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
  }, [active, onForegroundNotification])

  const enable = useCallback(async (): Promise<boolean> => {
    const push = await loadPushModule()
    if (!push.isPushSupported() || !deviceId) {
      setGuidance(push.PUSH_UNSUPPORTED_GUIDANCE)
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
      setStatus({ enabled: true, deviceRegistered: true })
      await api.upsertPushSubscription(deviceId, token)
      await refreshInternal(push, deviceId)
      return true
    } catch (err) {
      console.error('Could not enable push notifications.', err)
      setStatus(previousStatus)
      setGuidance(push.PUSH_UNSUPPORTED_GUIDANCE)
      return false
    } finally {
      setBusy(false)
    }
  }, [deviceId, refreshInternal, status])

  const disable = useCallback(async () => {
    const push = await loadPushModule()
    if (!push.isPushSupported() || !deviceId) return
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
      await refreshInternal(push, deviceId)
    } catch (err) {
      console.error('Could not disable push notifications.', err)
      setStatus(previousStatus)
      setGuidance(previousStatus?.enabled && !previousStatus.deviceRegistered
        ? push.PUSH_ENABLED_ELSEWHERE_MESSAGE
        : null)
    } finally {
      setBusy(false)
    }
  }, [deviceId, refreshInternal, status])

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
