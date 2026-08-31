import { CalendarDays, ChevronDown, ChevronUp, Loader2, LogOut, MonitorSmartphone, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import type { SessionSummary } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { buildMutationSuccessToast } from '../../lib/mutationToast'
import { useAppPrefs, useAppUi } from '../../contexts/AppContext'
import { CollapsibleBody } from '../ui/CollapsibleBody'
import { Panel } from '../ui/Panel'
import { MutationButtonContent, MutationStatusAnnouncement } from '../ui/MutationButtonContent'

const relativeTime = (iso: string | null): string => {
  if (!iso) return 'Never'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

export function ActiveDevicesSection() {
  const { hideSensitive } = useAppPrefs()
  const { showToast } = useAppUi()
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
  const [revokingOthers, setRevokingOthers] = useState(false)
  const load = async () => {
    setLoading(true)
    try {
      setSessions(await api.getSessions())
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load().catch(console.error) }, [])

  const revoke = async (id: string) => {
    if (hideSensitive || revokingSessionId !== null || revokingOthers) return
    const session = sessions.find(item => item.id === id)
    setRevokingSessionId(id)
    try {
      await api.revokeSession(id)
      await load()
      const copy = buildMutationSuccessToast({
        entity: 'Session',
        action: 'Revoked',
        recordName: session?.deviceName,
      })
      showToast(copy.message, copy.title, copy.tone)
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to revoke session.'), 'Error', 'error')
    } finally {
      setRevokingSessionId(null)
    }
  }
  const revokeOthers = async () => {
    if (hideSensitive || revokingSessionId !== null || revokingOthers) return
    setRevokingOthers(true)
    try {
      const { revokedCount } = await api.revokeAllSessions(true)
      await load()
      const copy = buildMutationSuccessToast({
        entity: 'Sessions',
        action: 'Revoked',
        message: `${revokedCount} other session${revokedCount === 1 ? '' : 's'} were revoked.`,
      })
      showToast(copy.message, copy.title, copy.tone)
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to log out other devices.'), 'Error', 'error')
    } finally {
      setRevokingOthers(false)
    }
  }

  const anyRevokeInProgress = revokingSessionId !== null || revokingOthers

  return (
    <Panel as="section" padding="none" className="overflow-hidden shadow-sm">
      <Button variant="unstyled" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full min-w-0 items-center gap-3 p-5 text-left cursor-pointer">
        <div className="shrink-0 rounded-xl bg-blue-500/10 p-2"><MonitorSmartphone className="size-4 text-blue-500" /></div>
        <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">Active Devices</h3><p className="truncate text-xs text-muted-foreground">Manage devices currently logged into your account.</p></div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
          {loading ? <><Loader2 className="size-3 animate-spin" /> Checking…</> : sessions.length}
        </span>
        {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
      </Button>
      <CollapsibleBody open={open}>
        <div className="px-5 pb-5 border-t border-border/40 pt-4 space-y-4">
          <div className="space-y-1.5">
            {sessions.map(session => {
              const isRevoking = revokingSessionId === session.id || (revokingOthers && !session.isCurrent)
              return (
                <div key={session.id} className="flex items-center justify-between gap-2 bg-muted/20 border border-border/40 px-3 py-2.5 rounded-xl text-xs" aria-busy={isRevoking}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="flex min-w-0 flex-wrap items-center gap-2 font-semibold"><MonitorSmartphone className="size-3.5 shrink-0 text-blue-500" />{session.deviceName || 'Unknown Device'}{session.isCurrent && <small className="shrink-0 text-blue-500">Current</small>}</span>
                    <span className="text-xs text-muted-foreground"><CalendarDays className="inline size-3" /> Logged in: {new Date(session.createdAt).toLocaleDateString()} · Last active: {relativeTime(session.lastActiveAt)}</span>
                    {session.ipAddress && <span className="text-xs text-muted-foreground">IP: {session.ipAddress}</span>}
                  </div>
                  {!session.isCurrent && <Button variant="unstyled" size="icon" type="button" onClick={() => void revoke(session.id)} disabled={hideSensitive || anyRevokeInProgress} aria-busy={revokingSessionId === session.id} aria-label={`Revoke ${session.deviceName || 'device session'}`} className="size-11 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-red-500 disabled:opacity-40 sm:size-8">{revokingSessionId === session.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}<MutationStatusAnnouncement state={revokingSessionId === session.id ? 'deleting' : null} entityLabel={session.deviceName || 'device session'} /></Button>}
                </div>
              )
            })}
          </div>
          {sessions.length > 1 && <Button variant="unstyled" type="button" onClick={() => void revokeOthers()} disabled={hideSensitive || anyRevokeInProgress} aria-busy={revokingOthers} className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-500/30 disabled:opacity-40"><MutationButtonContent state={revokingOthers ? 'deleting' : null} entityLabel="other device sessions" idleLabel="Log out all other devices" busyLabel="Revoking…" idleIcon={<LogOut className="size-3.5" />} /></Button>}
        </div>
      </CollapsibleBody>
    </Panel>
  )
}
