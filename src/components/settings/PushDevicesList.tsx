import React from 'react'
import { Loader2, MonitorSmartphone, Trash2 } from 'lucide-react'
import * as api from '../../lib/api'
import type { PushDevice } from '../../types'
import { getErrorMessage } from '../../lib/errors'
import { buildMutationSuccessToast } from '../../lib/mutationToast'
import { useAppUi } from '../../contexts/AppContext'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'

const enrolledOn = (iso: string): string => new Date(iso).toLocaleDateString()

interface PushDevicesListProps {
  // Rises whenever this device's own enrolment changes, so the list re-reads instead of showing
  // a browser that was just switched on or off.
  refreshKey: number
}

// Push opt-in is per device, and until this list existed the only evidence that another browser
// was enrolled was a one-line amber hint. Someone who enabled notifications on a shared or
// replaced machine had no way to see it, let alone stop it.
export const PushDevicesList: React.FC<PushDevicesListProps> = ({ refreshKey }) => {
  const { showToast } = useAppUi()
  const [devices, setDevices] = React.useState<PushDevice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)

  const load = React.useCallback(async (signal?: AbortSignal) => {
    const { getExistingDeviceId } = await import('../../lib/push/deviceId')
    const deviceId = getExistingDeviceId()
    if (!deviceId) {
      setDevices([])
      setLoading(false)
      return
    }
    try {
      const next = await api.fetchPushDevices(deviceId, signal)
      if (!signal?.aborted) setDevices(next)
    } catch (error) {
      if (!signal?.aborted) console.warn('Could not load the devices receiving notifications.', error)
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
      <p className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Checking which devices are set up…
      </p>
    )
  }

  if (devices.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground">
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
              <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
                <MonitorSmartphone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {device.isCurrent ? 'This device' : 'Another device'}
                <RowSyncStatus isDeleting={isRevoking} entityLabel="device" />
              </span>
              <span className="text-[10px] text-muted-foreground">Set up on {enrolledOn(device.enrolledAt)}</span>
            </span>
            {/* The current device is switched off with the switch above, so a second control for
                the same thing would be one more way to reach the same state, worded differently. */}
            {!device.isCurrent && (
              <Button
                variant="unstyled"
                type="button"
                onClick={() => void revoke(device)}
                disabled={revokingId !== null}
                aria-label="Stop notifications for this other device"
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:text-destructive disabled:opacity-40"
              >
                {isRevoking
                  ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  : <Trash2 className="size-3.5" aria-hidden="true" />}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
