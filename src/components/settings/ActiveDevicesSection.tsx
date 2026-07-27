import { CalendarDays, ChevronDown, ChevronUp, Loader2, LogOut, MonitorSmartphone, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import type { SessionSummary } from '../../lib/api'
import { getErrorMessage } from '../../lib/errors'
import { useAppPrefs, useAppUi } from '../../contexts/AppContext'
import { CollapsibleBody } from '../ui/CollapsibleBody'

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
    if (hideSensitive) return
    try {
      await api.revokeSession(id)
      await load()
      showToast('Session revoked.', 'Session removed', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to revoke session.'), 'Error', 'error')
    }
  }
  const revokeOthers = async () => {
    if (hideSensitive) return
    try {
      const { revokedCount } = await api.revokeAllSessions(true)
      await load()
      showToast(`Logged out ${revokedCount} other device(s).`, 'Devices logged out', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to log out other devices.'), 'Error', 'error')
    }
  }

  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="w-full flex items-center gap-3 p-5 text-left cursor-pointer">
        <div className="p-2 bg-blue-500/10 rounded-xl"><MonitorSmartphone className="size-4 text-blue-500" /></div>
        <div className="flex-1"><h3 className="text-sm font-bold">Active Devices</h3><p className="text-[11px] text-muted-foreground">Manage devices currently logged into your account.</p></div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
          {loading ? <><Loader2 className="size-3 animate-spin" /> Checking…</> : sessions.length}
        </span>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      <CollapsibleBody open={open}>
        <div className="px-5 pb-5 border-t border-border/40 pt-4 space-y-4">
          <div className="space-y-1.5">
            {sessions.map(session => (
              <div key={session.id} className="flex items-center justify-between gap-2 bg-muted/20 border border-border/40 px-3 py-2.5 rounded-xl text-xs">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="flex items-center gap-2 font-semibold"><MonitorSmartphone className="size-3.5 text-blue-500" />{session.deviceName || 'Unknown Device'}{session.isCurrent && <small className="text-blue-500">Current</small>}</span>
                  <span className="text-[10px] text-muted-foreground"><CalendarDays className="inline size-3" /> Logged in: {new Date(session.createdAt).toLocaleDateString()} · Last active: {relativeTime(session.lastActiveAt)}</span>
                  {session.ipAddress && <span className="text-[10px] text-muted-foreground/75">IP: {session.ipAddress}</span>}
                </div>
                {!session.isCurrent && <button type="button" onClick={() => void revoke(session.id)} disabled={hideSensitive} className="p-1.5 text-muted-foreground hover:text-red-500 disabled:opacity-40"><Trash2 className="size-3.5" /></button>}
              </div>
            ))}
          </div>
          {sessions.length > 1 && <button type="button" onClick={() => void revokeOthers()} disabled={hideSensitive} className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-500/30 disabled:opacity-40"><LogOut className="size-3.5" /> Log out all other devices</button>}
        </div>
      </CollapsibleBody>
    </section>
  )
}
