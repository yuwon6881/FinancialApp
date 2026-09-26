import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PurchaseCapturePlugin, supportsPurchaseCapture, type CaptureApplication, type CaptureState, type PurchaseCapture } from '../lib/native/purchaseCapture'
import { saveCapturedPurchase } from '../lib/native/saveCapturedPurchase'
import type { LedgerAddPrefill } from './useCycleNavigation'
import type { Transaction } from '../types'

export interface PurchaseCaptureOptions {
  owner: string | null
  eligible: boolean
  hidden: boolean
  formOpen: boolean
  currency: string
  reveal: () => void
  open: (prefill: LedgerAddPrefill) => void
  enqueue: (id: string, transaction: Omit<Transaction, 'id'>) => void
}

export function capturePrefill(candidate: PurchaseCapture, currency: string): LedgerAddPrefill {
  const matchingCurrency = candidate.currency === currency
  return {
    description: candidate.description,
    amount: matchingCurrency ? candidate.amount : undefined,
    date: candidate.date,
    ...candidate.edits,
    captureId: candidate.id,
    captureSource: candidate.sourceLabel,
    captureNotice: candidate.currency && !matchingCurrency
      ? `Detected ${candidate.currency} ${candidate.amount ?? ''}. Enter the amount in ${currency}; no conversion has been applied.`
      : !candidate.currency ? `Currency was not detected. Confirm the amount in ${currency}.` : undefined,
    captureExcerpt: candidate.excerpt,
  }
}

export function usePurchaseCapture(options: PurchaseCaptureOptions) {
  const supported = supportsPurchaseCapture()
  const [state, setState] = useState<CaptureState | null>(null)
  const [applications, setApplications] = useState<CaptureApplication[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const current = useRef(options)
  const inFlight = useRef(new Set<string>())
  const refreshRef = useRef<() => Promise<void>>(async () => undefined)
  const refreshing = useRef(false)
  const refreshRequested = useRef(false)
  const revealedTap = useRef<string | null>(null)
  useEffect(() => { current.current = options }, [options])

  const save = useCallback(async (id: string, transaction: Omit<Transaction, 'id'>) => {
    const latest = current.current
    if (!latest.owner || !latest.eligible || latest.hidden) throw new Error('Unlock and reveal financial data before saving.')
    if (inFlight.current.has(id)) throw new Error('This purchase is already being saved.')
    const owner = latest.owner
    inFlight.current.add(id)
    try {
      const snapshot = await PurchaseCapturePlugin.state({ owner })
      const candidate = snapshot.candidates.find(item => item.id === id)
      if (!candidate) throw new Error('This purchase has already been saved or discarded.')
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
      setState(snapshot)
      setError(null)
      if (!current.current.eligible) return
      if (snapshot.tapId && current.current.hidden && revealedTap.current !== snapshot.tapId) {
        revealedTap.current = snapshot.tapId
        current.current.reveal()
      }
      if (current.current.hidden) return
      for (const candidate of snapshot.candidates) {
        if (candidate.prepared && !inFlight.current.has(candidate.id)) {
          await save(candidate.id, candidate.prepared)
        }
      }
      const candidate = snapshot.candidates.find(item => item.id === snapshot.tapId && !item.prepared)
      if (candidate && !current.current.formOpen && current.current.owner === owner) {
        current.current.open(capturePrefill(candidate, current.current.currency))
        await PurchaseCapturePlugin.consumeTap({ owner })
      } else if (snapshot.tapId && !candidate) {
        await PurchaseCapturePlugin.consumeTap({ owner })
      }
    } catch {
      if (current.current.owner === owner) setError('Transaction detection could not refresh. Try again; stored purchases have been kept.')
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

  const perform = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    try { await operation(); await refresh(); return true }
    catch { setError('Could not update transaction detection. Try again.'); return false }
    finally { setBusy(false) }
  }
  const edit = useCallback(async (id: string, fields: Record<string, unknown>) => {
    const latest = current.current
    if (!latest.owner || !latest.eligible || latest.hidden) return
    await PurchaseCapturePlugin.update({ owner: latest.owner, id, action: 'edit', data: fields })
  }, [])

  const actions = useMemo(() => ({ save, edit }), [save, edit])
  return {
    supported, state, applications, error, busy, refresh, actions,
    loadApplications: () => perform(async () => {
      const result = await PurchaseCapturePlugin.applications()
      setApplications(result.applications.sort((a, b) => a.label.localeCompare(b.label)))
    }),
    configure: (enabled: boolean, packages: string[]) => perform(async () => {
      if (!current.current.owner) throw new Error('Sign in first')
      await PurchaseCapturePlugin.configure({ owner: current.current.owner, enabled, packages })
      if (enabled) await PurchaseCapturePlugin.requestNotifications()
    }),
    accessSettings: () => perform(() => PurchaseCapturePlugin.openAccessSettings()),
    notificationSettings: () => perform(() => PurchaseCapturePlugin.openNotificationSettings()),
    review: (candidate: PurchaseCapture) => {
      if (!current.current.eligible || current.current.formOpen) return
      if (current.current.hidden) { current.current.reveal(); return }
      current.current.open(capturePrefill(candidate, current.current.currency))
    },
    discard: (id: string) => perform(async () => {
      if (!current.current.owner || !current.current.eligible || current.current.hidden) throw new Error('Unlock first')
      await PurchaseCapturePlugin.update({ owner: current.current.owner, id, action: 'discard' })
    }),
  }
}
