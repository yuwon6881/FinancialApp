import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PurchaseCapturePlugin, supportsPurchaseCapture, type CaptureApplication, type CaptureState, type PurchaseCapture } from '../lib/native/purchaseCapture'
import { saveCapturedPurchase } from '../lib/native/saveCapturedPurchase'
import { capturePrefill, sortCaptures } from '../lib/native/capturePrefill'
import { getDraftTransactionIssues } from '../lib/draftTransactionValidation'
import type { LedgerAddPrefill } from './useCycleNavigation'
import type { Transaction } from '../types'
import type { TransactionCategory } from '../types/categories'

export interface PurchaseCaptureOptions {
  owner: string | null
  eligible: boolean
  hidden: boolean
  formOpen: boolean
  currency: string
  categories: TransactionCategory[]
  reveal: () => void
  open: (prefill: LedgerAddPrefill) => void
  enqueue: (id: string, transaction: Omit<Transaction, 'id'>) => void
}

export function usePurchaseCapture(options: PurchaseCaptureOptions) {
  const supported = supportsPurchaseCapture()
  const [state, setState] = useState<CaptureState | null>(null)
  const [applications, setApplications] = useState<CaptureApplication[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = useRef(options)
  const inFlight = useRef(new Set<string>())
  const refreshRef = useRef<() => Promise<void>>(async () => undefined)
  const refreshing = useRef(false)
  const refreshRequested = useRef(false)
  const revealedTap = useRef<string | null>(null)
  /** A review asked for while balances were hidden opens once they are revealed. */
  const reviewAfterReveal = useRef<string | null>(null)
  useEffect(() => { current.current = options }, [options])

  const save = useCallback(async (id: string, transaction: Omit<Transaction, 'id'>, recovering = false) => {
    const latest = current.current
    if (!latest.owner || !latest.eligible || latest.hidden) throw new Error('Unlock and reveal financial data before saving.')
    if (inFlight.current.has(id)) throw new Error('This transaction is already being saved.')
    const owner = latest.owner
    inFlight.current.add(id)
    try {
      const snapshot = await PurchaseCapturePlugin.state({ owner })
      const candidate = snapshot.candidates.find(item => item.id === id)
      if (!candidate) throw new Error('This transaction has already been saved or discarded.')
      // The same rules a Ledger draft must pass before it reaches the outbox.
      if (!recovering && !candidate.prepared) {
        const [issue] = getDraftTransactionIssues({ ...transaction, id: candidate.transactionId }, latest.categories)
        if (issue) throw new Error(issue)
      }
      await saveCapturedPurchase(candidate, transaction, {
        prepare: data => PurchaseCapturePlugin.update({ owner, id, action: 'prepare', data: { ...data, postedAt: data.postedAt ?? new Date().toISOString() } }),
        enqueue: (transactionId, data) => {
          if (current.current.owner !== owner || !current.current.eligible || current.current.hidden) throw new Error('The account was locked. Unlock to finish saving.')
          current.current.enqueue(transactionId, data)
        },
        complete: () => PurchaseCapturePlugin.update({ owner, id, action: 'complete' }),
      })
      await refreshRef.current()
    } finally { inFlight.current.delete(id) }
  }, [])

  const refresh = useCallback(async () => {
    if (refreshing.current) { refreshRequested.current = true; return }
    const latest = current.current
    if (!supported || !latest.owner) return
    const owner = latest.owner
    refreshing.current = true
    try {
      const snapshot = await PurchaseCapturePlugin.state({ owner })
      if (current.current.owner !== owner) return
      setState({ ...snapshot, candidates: sortCaptures(snapshot.candidates) })
      setError(null)
      if (!current.current.eligible) return
      if (snapshot.tapId && current.current.hidden && revealedTap.current !== snapshot.tapId) {
        revealedTap.current = snapshot.tapId
        current.current.reveal()
      }
      if (current.current.hidden) return
      // One interrupted approval must not hold every other capture, or the tapped one, hostage.
      let recoveryFailed = false
      for (const candidate of snapshot.candidates) {
        if (!candidate.prepared || inFlight.current.has(candidate.id)) continue
        try { await save(candidate.id, candidate.prepared, true) }
        catch { recoveryFailed = true }
      }
      const wanted = snapshot.tapId ?? reviewAfterReveal.current
      const candidate = snapshot.candidates.find(item => item.id === wanted && !item.prepared)
      if (candidate && !current.current.formOpen && current.current.owner === owner) {
        reviewAfterReveal.current = null
        current.current.open(capturePrefill(candidate, current.current.currency))
        if (snapshot.tapId) await PurchaseCapturePlugin.consumeTap({ owner })
      } else if (wanted && !candidate) {
        reviewAfterReveal.current = null
        if (snapshot.tapId) await PurchaseCapturePlugin.consumeTap({ owner })
      }
      if (recoveryFailed && current.current.owner === owner) {
        setError('An approved transaction has not reached the Ledger yet. It will retry automatically; you can also retry now.')
      }
    } catch {
      if (current.current.owner === owner) setError('Detected transactions could not be loaded. Try again; nothing has been lost.')
    } finally {
      refreshing.current = false
      if (refreshRequested.current) {
        refreshRequested.current = false
        queueMicrotask(() => { void refreshRef.current() })
      }
    }
  }, [save, supported])
  useEffect(() => { refreshRef.current = refresh }, [refresh])

  useEffect(() => {
    if (!supported) return
    let disposed = false
    setState(null)
    setApplications([])
    revealedTap.current = null
    reviewAfterReveal.current = null
    void PurchaseCapturePlugin.activate({ owner: options.owner }).then(() => {
      if (!disposed && options.owner) return refresh()
    }).catch(() => { if (!disposed) setError('Transaction detection storage is unavailable. Try again.') })
    return () => { disposed = true }
  }, [options.owner, supported, refresh])

  useEffect(() => {
    if (!supported) return
    let disposed = false
    let removeCapture: (() => void) | undefined
    let removeApp: (() => void) | undefined
    void PurchaseCapturePlugin.addListener('changed', () => { void refresh() }).then(handle => {
      if (disposed) void handle.remove(); else removeCapture = () => { void handle.remove() }
    })
    void import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', event => { if (event.isActive) void refresh() })).then(handle => {
      if (disposed) void handle.remove(); else removeApp = () => { void handle.remove() }
    })
    return () => { disposed = true; removeCapture?.(); removeApp?.() }
  }, [refresh, supported])
  useEffect(() => {
    if (options.eligible && !options.hidden) void refresh()
  }, [options.eligible, options.hidden, options.formOpen, refresh])

  const perform = async (operation: () => Promise<unknown>, failure = 'Could not update transaction detection. Try again.') => {
    setBusy(true)
    try { await operation(); await refresh(); return true }
    catch { setError(failure); return false }
    finally { setBusy(false) }
  }
  const edit = useCallback(async (id: string, fields: Record<string, unknown>) => {
    const latest = current.current
    if (!latest.owner || !latest.eligible || latest.hidden) return
    await PurchaseCapturePlugin.update({ owner: latest.owner, id, action: 'edit', data: fields })
  }, [])

  const actions = useMemo(() => ({ save: (id: string, transaction: Omit<Transaction, 'id'>) => save(id, transaction), edit }), [save, edit])
  return {
    supported, state, applications, applicationsLoading, error, busy, refresh, actions,
    loadApplications: async () => {
      setApplicationsLoading(true)
      try {
        const result = await PurchaseCapturePlugin.applications()
        setApplications([...result.applications].sort((a, b) => a.label.localeCompare(b.label)))
        return true
      } catch {
        setError('Installed apps could not be listed. Try again.')
        return false
      } finally { setApplicationsLoading(false) }
    },
    configure: (enabled: boolean, packages: string[]) => perform(async () => {
      if (!current.current.owner) throw new Error('Sign in first')
      await PurchaseCapturePlugin.configure({ owner: current.current.owner, enabled, packages })
      if (enabled) await PurchaseCapturePlugin.requestNotifications()
    }),
    /** Turning detection on only visits Android settings when access is actually missing. */
    enable: (packages: string[]) => perform(async () => {
      if (!current.current.owner) throw new Error('Sign in first')
      await PurchaseCapturePlugin.configure({ owner: current.current.owner, enabled: true, packages })
      await PurchaseCapturePlugin.requestNotifications()
      const latest = await PurchaseCapturePlugin.state({ owner: current.current.owner })
      if (!latest.access) await PurchaseCapturePlugin.openAccessSettings()
    }),
    accessSettings: () => perform(() => PurchaseCapturePlugin.openAccessSettings()),
    reconnect: () => perform(async () => {
      const latest = current.current
      if (!latest.owner || !latest.eligible || latest.hidden) throw new Error('Unlock first')
      // Older installed shells do not implement reconnect; their existing state read already requests a rebind.
      if (state?.listenerRecovery !== undefined) await PurchaseCapturePlugin.reconnect({ owner: latest.owner })
    }, 'Detection could not reconnect. Review notification access in Android settings.'),
    notificationSettings: () => perform(() => PurchaseCapturePlugin.openNotificationSettings()),
    batterySettings: () => perform(() => PurchaseCapturePlugin.openBatterySettings()),
    review: (candidate: PurchaseCapture) => {
      if (!current.current.eligible || current.current.formOpen) return
      if (current.current.hidden) {
        reviewAfterReveal.current = candidate.id
        current.current.reveal()
        return
      }
      current.current.open(capturePrefill(candidate, current.current.currency))
    },
    discard: (id: string) => perform(async () => {
      if (!current.current.owner || !current.current.eligible || current.current.hidden) throw new Error('Unlock first')
      await PurchaseCapturePlugin.update({ owner: current.current.owner, id, action: 'discard' })
    }, 'This detected transaction could not be discarded. Try again.'),
  }
}
