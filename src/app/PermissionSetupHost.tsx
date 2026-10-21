import { useCallback, useContext, useEffect, useState } from 'react'
import { BatteryCharging, BellRing, Camera, ScanText } from 'lucide-react'
import { PurchaseCaptureDetectionContext } from '../contexts/PurchaseCaptureContext'
import { PermissionSetupSheet, type PermissionRow } from '../components/permissions/PermissionSetupSheet'
import { DetectionConsentSheet } from '../components/settings/transaction-detection/DetectionSetupSheet'
import { SourceAppsSheet } from '../components/settings/transaction-detection/SourceAppsSheet'
import {
  canOpenSystemSettings,
  checkCameraPermission,
  checkNotificationPermission,
  hasSeenPermissionSetup,
  markPermissionSetupSeen,
  openAppSystemSettings,
  openNotificationSystemSettings,
  requestCameraPermission,
  type DevicePermission,
} from '../lib/native/devicePermissions'
import type { PushChannel } from '../types'
import type { UsePushNotificationsResult } from './usePushNotifications'

/** Long enough for the first screen to paint, so the sheet reads as an offer rather than a wall. */
const FIRST_RUN_DELAY_MS = 900

export interface PermissionSetupHostProps {
  /** Settings asked for the sheet. */
  requested: boolean
  onRequestClosed: () => void
  /**
   * True only while nothing else holds the screen: signed in, unlocked, account setup finished and
   * no other sheet open. The unprompted first showing waits for it.
   */
  ready: boolean
  push: UsePushNotificationsResult
  hidden: boolean
  onReveal: () => void
}

type Working = 'notifications' | 'camera' | 'all' | null

export default function PermissionSetupHost({ requested, onRequestClosed, ready, push, hidden, onReveal }: PermissionSetupHostProps) {
  const detection = useContext(PurchaseCaptureDetectionContext)
  const [firstRun, setFirstRun] = useState(false)
  const open = requested || firstRun
  const [camera, setCamera] = useState<DevicePermission | null>(null)
  const [notifications, setNotifications] = useState<DevicePermission | null>(null)
  const [notificationsFailed, setNotificationsFailed] = useState(false)
  const [working, setWorking] = useState<Working>(null)
  const [consentOpen, setConsentOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectionKey, setSelectionKey] = useState(0)

  const readStates = useCallback(async () => {
    const [nextCamera, nextNotifications] = await Promise.all([checkCameraPermission(), checkNotificationPermission()])
    setCamera(nextCamera)
    setNotifications(nextNotifications)
  }, [])

  useEffect(() => {
    if (!ready || hasSeenPermissionSetup()) return
    const timer = window.setTimeout(() => setFirstRun(true), FIRST_RUN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [ready])

  // Each answer may be given in system settings, so the rows are re-read on every return to the app.
  useEffect(() => {
    if (!open) return
    let disposed = false
    let remove: (() => void) | undefined
    void readStates()
    void import('@capacitor/app')
      .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => { if (isActive) void readStates() }))
      .then(handle => { if (disposed) void handle.remove(); else remove = () => { void handle.remove() } })
      .catch(() => undefined)
    return () => { disposed = true; remove?.() }
  }, [open, readStates])

  const enrolled = push.billRemindersEnabled || push.categoryAlertsEnabled
  const notificationsNeeded = push.supported && !push.loading && notifications !== null
    && notifications !== 'blocked' && !(notifications === 'granted' && enrolled)
  const cameraNeeded = camera === 'prompt'
  const state = detection?.state ?? null
  const detectionReady = Boolean(state?.enabled && state.access && state.packages.length)

  // Allowing notifications here means getting them: the permission alone delivers nothing until
  // this installation is enrolled for at least one kind, which the Settings switches otherwise do.
  const enableNotifications = async () => {
    setNotificationsFailed(false)
    const channels: PushChannel[] = []
    if (!push.billRemindersEnabled) channels.push('billReminders')
    if (!push.categoryAlertsEnabled) channels.push('categoryAlerts')
    for (const channel of channels) {
      if (!await push.setChannelEnabled(channel, true)) {
        setNotificationsFailed(true)
        break
      }
    }
    await readStates()
  }

  const run = async (key: Exclude<Working, null>, operation: () => Promise<unknown>) => {
    setWorking(key)
    try { await operation() } finally { setWorking(null) }
  }

  const beginSelection = () => {
    setSelectionKey(key => key + 1)
    setSelecting(true)
    void detection?.loadApplications()
  }
  /** The next step detection needs, so one press always moves it forward. */
  const continueDetection = () => {
    if (!detection || !state) return
    if (hidden) onReveal()
    else if (!state.enabled) setConsentOpen(true)
    else if (!state.access) void detection.accessSettings()
    else if (!state.packages.length) beginSelection()
  }

  const allowAll = () => run('all', async () => {
    if (notificationsNeeded) await enableNotifications()
    if (cameraNeeded) setCamera(await requestCameraPermission())
    // Detection always passes through its own consent, so "all" stops there for the user to read it.
    if (detection && state && !detectionReady && !hidden) continueDetection()
  })

  const busy = working !== null
  const rows: PermissionRow[] = []

  rows.push({
    id: 'notifications',
    icon: BellRing,
    title: 'Notifications',
    description: 'Bill reminders and category spending alerts on this phone.',
    ...(!push.supported
      ? { status: 'unavailable' as const, note: push.guidance ?? undefined }
      : push.loading || notifications === null
        ? { status: 'checking' as const }
        : notifications === 'blocked'
          ? {
            status: 'blocked' as const,
            note: canOpenSystemSettings()
              ? 'Notifications are off for FinancialApp. Turn them on in Android settings.'
              : 'Notifications are off for FinancialApp. Turn them on in the Settings app.',
            action: canOpenSystemSettings() ? { label: 'Open settings', onClick: () => { void openNotificationSystemSettings() }, disabled: busy } : undefined,
          }
          : notificationsNeeded
            ? {
              status: 'needed' as const,
              note: !notificationsFailed ? undefined
                : notifications === 'granted' ? 'Notifications could not be turned on. Check your connection and try again.'
                : 'Notifications were not allowed. Press Allow to be asked again.',
              action: { label: 'Allow', onClick: () => { void run('notifications', enableNotifications) }, loading: working === 'notifications' || push.busy, disabled: busy && working !== 'notifications' },
            }
            : { status: 'allowed' as const }),
  })

  if (camera !== 'unavailable') {
    rows.push({
      id: 'camera',
      icon: Camera,
      title: 'Camera',
      description: 'Snap a receipt to fill in a transaction.',
      ...(camera === null
        ? { status: 'checking' as const }
        : camera === 'granted'
          ? { status: 'allowed' as const }
          : camera === 'blocked'
            ? {
              status: 'blocked' as const,
              note: canOpenSystemSettings()
                ? 'Camera access is off for FinancialApp. Allow it under Permissions in Android settings.'
                : 'Camera access is off for FinancialApp. Allow it in the Settings app.',
              action: canOpenSystemSettings() ? { label: 'Open settings', onClick: () => { void openAppSystemSettings() }, disabled: busy } : undefined,
            }
            : {
              status: 'needed' as const,
              action: { label: 'Allow', onClick: () => { void run('camera', async () => setCamera(await requestCameraPermission())) }, loading: working === 'camera', disabled: busy && working !== 'camera' },
            }),
    })
  }

  if (detection?.supported) {
    const step = !state ? null
      : !state.enabled ? 'Set up'
      : !state.access ? 'Allow access'
      : !state.packages.length ? 'Choose apps'
      : null
    rows.push({
      id: 'detection',
      icon: ScanText,
      title: 'Transaction detection',
      description: 'Reads payment alerts from the bank and wallet apps you choose, so you can add them in a tap.',
      ...(!state
        ? { status: 'checking' as const }
        : detectionReady
          ? { status: 'allowed' as const }
          : {
            status: state.enabled ? 'incomplete' as const : 'needed' as const,
            note: hidden
              ? 'Reveal financial data to set up detection.'
              : state.enabled && !state.access ? 'Allow notification access for FinancialApp in Android settings.' : undefined,
            action: {
              label: hidden ? 'Reveal' : step ?? 'Set up',
              onClick: continueDetection,
              loading: detection.busy,
              disabled: busy,
            },
          }),
    })
    if (state?.enabled && state.batteryUnrestricted !== undefined) {
      rows.push({
        id: 'battery',
        icon: BatteryCharging,
        title: 'Keep detection running',
        description: 'Set Battery to Unrestricted so Android does not stop detection while the phone sleeps.',
        status: state.batteryUnrestricted ? 'allowed' : 'optional',
        action: state.batteryUnrestricted ? undefined : {
          label: 'Battery settings',
          onClick: () => { void detection.batterySettings() },
          disabled: busy || detection.busy || hidden,
        },
      })
    }
  }

  const close = () => {
    setFirstRun(false)
    onRequestClosed()
    setConsentOpen(false)
    setSelecting(false)
    markPermissionSetupSeen(rows.every(row => row.status !== 'needed' && row.status !== 'incomplete') ? 'completed' : 'skipped')
  }

  const canAllowAll = notificationsNeeded || cameraNeeded || Boolean(detection?.supported && state && !detectionReady && !hidden)

  return (
    <>
      <PermissionSetupSheet
        isOpen={open}
        rows={rows}
        onAllowAll={canAllowAll ? () => { void allowAll() } : undefined}
        allowAllBusy={working === 'all'}
        onClose={close}
        firstRun={firstRun}
      />
      {detection?.supported && (
        <>
          <DetectionConsentSheet
            isOpen={open && consentOpen && !hidden}
            onClose={() => setConsentOpen(false)}
            busy={detection.busy}
            disabled={!state}
            onAgree={async () => {
              if (await detection.enable(state?.packages ?? [])) {
                setConsentOpen(false)
                if (!state?.packages.length) beginSelection()
              }
            }}
          />
          <SourceAppsSheet
            key={selectionKey}
            isOpen={open && selecting && !hidden}
            onClose={() => setSelecting(false)}
            applications={detection.applications}
            loading={detection.applicationsLoading}
            busy={detection.busy}
            initial={state?.packages ?? []}
            onSave={packages => detection.configure(state?.enabled ?? false, packages)}
          />
        </>
      )}
    </>
  )
}
