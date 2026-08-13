import { useCallback, useEffect, useState } from 'react'
import type { PushChannel, PushStatus } from '../types'

export type PushBusyAction = PushChannel | null

export interface UsePushNotificationsResult {
  supported: boolean
  loading: boolean
  busy: boolean
  busyAction: PushBusyAction
  billRemindersEnabled: boolean
  categoryAlertsEnabled: boolean
  otherDevicesBillReminders: boolean
  otherDevicesCategoryAlerts: boolean
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

let controllerPromise: Promise<typeof import('./pushNotificationController')> | null = null
function loadController() {
  controllerPromise ??= import('./pushNotificationController')
  return controllerPromise
}

export function usePushNotifications(
  active = true,
  onForegroundNotification?: (message: string, title?: string) => void,
  account?: string | null,
  urgent = false,
): UsePushNotificationsResult {
  const [supported, setSupported] = useState(true)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<PushBusyAction>(null)
  const [guidance, setGuidance] = useState<string | null>(null)
  const [enrolmentRevision, setEnrolmentRevision] = useState(0)
  const markEnrolmentChanged = useCallback(() => setEnrolmentRevision(current => current + 1), [])

  const refresh = useCallback(async () => {
    if (!active) {
      setLoading(false)
      return null
    }
    const controller = await loadController()
    const device = controller.getPushDevice()
    setSupported(device.supported)
    setGuidance(device.guidance)
    if (!device.deviceId) {
      setLoading(false)
      return null
    }
    setDeviceId(device.deviceId)
    try {
      const next = await controller.fetchPushStatus(device.deviceId)
      setStatus(next)
      return next
    } catch (error) {
      console.error('Could not fetch push notification status.', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [active])

  useEffect(() => {
    if (!active) {
      setStatus(null)
      setLoading(false)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setLoading(true)
    const run = () => void loadController()
      .then(controller => controller.reconcilePush(account, {
        isCancelled: () => cancelled,
        setSupported,
        setGuidance,
        setStatus: next => {
          setStatus(next)
          setLoading(false)
        },
        enrolmentChanged: markEnrolmentChanged,
      }))
      .then(id => { if (!cancelled) setDeviceId(id) })
      .catch(error => {
        console.error('Could not reconcile push notification status.', error)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    if (urgent) run()
    else timer = setTimeout(run, 0)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [active, account, markEnrolmentChanged, urgent])

  useEffect(() => {
    if (!active || !onForegroundNotification || !status?.deviceRegistered || Notification.permission !== 'granted') return
    let disposed = false
    let unsubscribe: (() => void) | undefined
    void loadController().then(controller => controller.startForegroundPush(onForegroundNotification))
      .then(cleanup => {
        if (disposed) cleanup()
        else unsubscribe = cleanup
      })
      .catch(error => console.warn('Could not start foreground push handling.', error))
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [active, onForegroundNotification, status?.deviceRegistered])

  const setChannelEnabled = useCallback(async (channel: PushChannel, enabled: boolean) => {
    const controller = await loadController()
    const device = deviceId ? { supported: true, deviceId, guidance: null } : controller.getPushDevice()
    if (!device.supported || !device.deviceId) {
      setGuidance(device.guidance)
      return false
    }
    if (!deviceId) setDeviceId(device.deviceId)
    const previous = status ?? EMPTY_STATUS
    setBusyAction(channel)
    setGuidance(null)
    try {
      const result = await controller.setPushChannel(
        account,
        device.deviceId,
        previous,
        channel,
        enabled,
        setStatus,
      )
      setStatus(result.status)
      setGuidance(result.guidance)
      if (result.enrolmentChanged) markEnrolmentChanged()
      return result.success
    } finally {
      setBusyAction(null)
    }
  }, [account, deviceId, markEnrolmentChanged, status])

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
