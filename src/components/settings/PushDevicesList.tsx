import React from 'react'
import { AlertCircle, Loader2, MonitorSmartphone, RefreshCw, Trash2 } from 'lucide-react'
import * as api from '../../lib/api'
import type { PushDevice } from '../../types'
import { getErrorMessage } from '../../lib/errors'
import { buildMutationSuccessToast } from '../../lib/mutationToast'
import { PUSH_DEVICES_UNAVAILABLE } from '../../lib/push/messages'
import { useAppUi } from '../../contexts/AppContext'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { MutationStatusAnnouncement } from '../ui/MutationButtonContent'

const enrolledOn = (iso: string): string => new Date(iso).toLocaleDateString()

// What one device receives, in the same words as the switches above it. A device is only listed
// while it receives something, so an empty pair cannot occur.
const receivesLabel = (device: PushDevice): string => {
  if (device.billRemindersEnabled && device.categoryAlertsEnabled) return 'Bill reminders and spending alerts'
  return device.billRemindersEnabled ? 'Bill reminders' : 'Spending alerts'
}

interface PushDevicesListProps {
  // Rises once per server-confirmed enrolment change, so the list re-reads instead of showing a
  // browser that was just switched on or off. It is deliberately a revision counter and not the
  // switch state: that state flips optimistically, so keying on it read the roster while the write
  // was still in flight and then had no reason to read again.
  refreshKey: number
}

// Push opt-in is per device, and until this list existed the only evidence that another browser
// was enrolled was a one-line amber hint. Someone who enabled notifications on a shared or
// replaced machine had no way to see it, let alone stop it.
export const PushDevicesList: React.FC<PushDevicesListProps> = ({ refreshKey }) => {
  const { showToast } = useAppUi()
  const [devices, setDevices] = React.useState<PushDevice[]>([])
  const [loading, setLoading] = React.useState(true)
  // A failed read must not fall into the "no device is set up" empty state. That is a different
  // and confidently wrong answer, and it reads as proof that the switches above did nothing --
  // which is exactly how a broken roster gets mistaken for a broken enrolment.
  const [failed, setFailed] = React.useState(false)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)

  const load = React.useCallback(async (signal?: AbortSignal) => {
    const { getExistingDeviceId } = await import('../../lib/push/deviceId')
    const deviceId = getExistingDeviceId()
    try {
      // No local device id yet means this browser has never enrolled, but the account may still
      // have other devices worth showing -- the id only decides which row is marked "this device".
      const next = await api.fetchPushDevices(deviceId ?? '', signal)
      if (!signal?.aborted) {
        setDevices(next)
        setFailed(false)
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.warn('Could not load the devices receiving notifications.', error)
        setFailed(true)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void load(controller.signal)
    return () => controller.abort()
  }, [load, refreshKey])

  const revoke = async (device: PushDevice) => {
    if (revokingId) return
    setRevokingId(device.id)
    try {
      await api.revokePushDevice(device.id)
      await load()
      const copy = buildMutationSuccessToast({
        entity: 'Device',
        action: 'Updated',
        message: 'That device will stop receiving notifications.',
      })
      showToast(copy.message, copy.title, copy.tone)
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to stop notifications for that device.'), 'Error', 'error')
    } finally {
      setRevokingId(null)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Checking which devices are set up…
      </p>
    )
  }

  if (failed) {
    return (
      <div role="status" className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 size-3 shrink-0 text-amber-500" aria-hidden="true" />
        <span className="flex-1">
          {PUSH_DEVICES_UNAVAILABLE}{' '}
          <Button
            variant="tertiary"
            type="button"
            onClick={() => { setLoading(true); void load() }}
            className="inline-flex items-center gap-1 font-bold text-accent-ink hover:underline"
          >
            <RefreshCw className="size-3" aria-hidden="true" /> Try again
          </Button>
        </span>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No device is set up to receive notifications yet.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {devices.map(device => {
        const isRevoking = revokingId === device.id
        return (
          <li
            key={device.id}
            aria-busy={isRevoking}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <MonitorSmartphone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {device.isCurrent ? 'Current installation' : 'Another installation'}
              </span>
              {/* Naming what each device receives is what makes "on for another device" checkable
                  rather than something the app just asserts. */}
              <span className="text-xs text-muted-foreground">
                {receivesLabel(device)} · set up on {enrolledOn(device.enrolledAt)}
              </span>
            </span>
            {/* The current device is switched off with the switches above, so a second control for
                the same thing would be one more way to reach the same state, worded differently. */}
            {!device.isCurrent && (
              <IconButton
                type="button"
                onClick={() => void revoke(device)}
                disabled={revokingId !== null}
                label="Stop notifications for this other device"
                aria-busy={isRevoking}
                className="size-11 shrink-0 rounded-lg text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:opacity-40 sm:size-8"
              >
                {isRevoking
                  ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  : <Trash2 className="size-3.5" aria-hidden="true" />}
                <MutationStatusAnnouncement state={isRevoking ? 'deleting' : null} entityLabel="notification device" />
              </IconButton>
            )}
          </li>
        )
      })}
    </ul>
  )
}
