import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { ToastAction, ToastTone } from '../components/ui/ToastViewport'
import { CACHE_KEYS, getCachedJSON, getCachedOps, setCachedJSON } from './cache'
import {
  describeFailedOp,
  enqueue as enqueueOperation,
  getSyncSuccessToast,
  sanitizeQueuedOps,
  type DispatchResult,
  type EntityKind,
  type OpType,
  type OutboxPayload,
  type QueuedOp,
} from './outbox'
import { drainQueue, type SuccessfulSyncOp } from './outboxSync'
import { buildUndoAction, releaseUndoSnapshot, remapUndoSnapshotTarget, snapshotForUndo, type RequestSensitiveReveal, type UndoSnapshot } from './undo'
import { Eye } from 'lucide-react'
import { triggerHaptic } from './haptics'

const TOAST_STAGGER_MS = 350

interface UseOutboxOptions {
  token: string | null
  lastUnlockedTimeRef: MutableRefObject<number>
  setError: (message: string | null) => void
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  onAuthError: () => void
  onLockError: () => void
  onRequestSensitiveReveal?: RequestSensitiveReveal
  shouldRefresh?: (successfulOps: ReadonlyArray<SuccessfulSyncOp>) => boolean
  refresh: (successfulOps: ReadonlyArray<SuccessfulSyncOp>) => Promise<void>
  onViewFailedOps?: () => void
}

export interface UseOutboxResult {
  pendingOps: QueuedOp[]
  failedOps: QueuedOp[]
  activeOps: QueuedOp[]
  isBackgroundSyncing: boolean
  activeSyncId: string | null
  deletingId: string | null
  syncCountdownMs: number
  editingPendingId: string | null
  enqueue: (
    queue: QueuedOp[],
    entity: EntityKind,
    type: OpType,
    targetId: string,
    payload?: OutboxPayload,
    isUndo?: boolean,
  ) => QueuedOp[]
  mutateQueue: (updater: (previous: QueuedOp[]) => QueuedOp[]) => void
  snapshotForUndo: (entity: EntityKind, targetId: string, value: UndoSnapshot | undefined) => void
  processQueue: () => Promise<void>
  setBackgroundSyncing: (value: boolean) => void
  setDeletingId: (id: string | null) => void
  setEditingPendingId: (id: string | null) => void
  discardFailedOp: (id: string) => void
  discardAllFailedOps: () => void
  mutateFailedOps: (updater: (previous: QueuedOp[]) => QueuedOp[]) => void
  getPendingOps: () => QueuedOp[]
  getActiveOps: () => QueuedOp[]
  getFailedOps: () => QueuedOp[]
  reset: () => void
}

export function useOutbox(options: UseOutboxOptions): UseOutboxResult {
  const [pendingOps, setPendingOps] = useState<QueuedOp[]>(() => getCachedOps())
  const [failedOps, setFailedOps] = useState<QueuedOp[]>(() => {
    const raw = getCachedJSON<unknown>('failed_operations', [])
    const sanitized = sanitizeQueuedOps(raw)
    if (Array.isArray(raw) && sanitized.length !== raw.length) {
      setCachedJSON('failed_operations', sanitized)
    }
    return sanitized
  })
  const [recentlyCompletedOps, setRecentlyCompletedOps] = useState<QueuedOp[]>([])
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false)
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncBackoffUntil, setSyncBackoffUntil] = useState(0)
  const [syncCountdownMs, setSyncCountdownMs] = useState(0)
  const [editingPendingId, setEditingPendingIdState] = useState<string | null>(null)

  const optionsRef = useRef(options)
  const pendingOpsRef = useRef(pendingOps)
  const failedOpsRef = useRef(failedOps)
  const recentlyCompletedOpsRef = useRef(recentlyCompletedOps)
  const editingPendingIdRef = useRef(editingPendingId)
  const syncBackoffUntilRef = useRef(syncBackoffUntil)
  // Consecutive retryable failures, driving the escalating wait. A ref, not state: nothing
  // renders from it, and it must survive the re-renders each backoff change causes.
  const backoffAttemptRef = useRef(0)
  const isSyncingRef = useRef(false)
  const activeSyncOpIdRef = useRef<string | null>(null)
  const nextToastAtRef = useRef(0)
  const undoSnapshotsRef = useRef<Map<string, UndoSnapshot>>(new Map())
  const dispatchModuleRef = useRef<Promise<typeof import('./outboxDispatch')> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    pendingOpsRef.current = pendingOps
    if (!setCachedJSON(CACHE_KEYS.pendingOperations, pendingOps)) {
      optionsRef.current.showToast(
        'Pending changes could not be saved on this device. Free some storage and try again.',
        'Storage Full',
        'error',
      )
    }
  }, [pendingOps])

  useEffect(() => {
    failedOpsRef.current = failedOps
    if (!setCachedJSON('failed_operations', failedOps)) {
      optionsRef.current.showToast(
        'Failed sync items could not be saved on this device. Free some storage and try again.',
        'Storage Full',
        'error',
      )
    }
  }, [failedOps])

  useEffect(() => {
    editingPendingIdRef.current = editingPendingId
  }, [editingPendingId])

  useEffect(() => {
    syncBackoffUntilRef.current = syncBackoffUntil
    if (!syncBackoffUntil) {
      setSyncCountdownMs(0)
      return
    }
    const update = () => setSyncCountdownMs(Math.max(0, syncBackoffUntil - Date.now()))
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [syncBackoffUntil])

  const enqueue = useCallback<UseOutboxResult['enqueue']>((queue, entity, type, targetId, payload, isUndo) => {
    return enqueueOperation(queue, entity, type, targetId, payload, isUndo, activeSyncOpIdRef.current)
  }, [])

  const mutateQueue = useCallback((updater: (previous: QueuedOp[]) => QueuedOp[]) => {
    const next = updater(pendingOpsRef.current)
    pendingOpsRef.current = next
    setPendingOps(next)
  }, [])

  const setEditingPendingId = useCallback((id: string | null) => {
    editingPendingIdRef.current = id
    setEditingPendingIdState(id)
  }, [])

  const captureUndo = useCallback((entity: EntityKind, targetId: string, value: UndoSnapshot | undefined) => {
    snapshotForUndo(undoSnapshotsRef.current, entity, targetId, value)
  }, [])

  const createUndo = useCallback((op: QueuedOp, result: DispatchResult) => {
    return buildUndoAction(undoSnapshotsRef.current, op, result, (entity, type, targetId, payload) => {
      mutateQueue(previous => enqueue(previous, entity, type, targetId, payload, true))
    }, options.onRequestSensitiveReveal)
  }, [enqueue, mutateQueue, options.onRequestSensitiveReveal])

  const processQueueRef = useRef<() => void>(() => undefined)
  const processQueue = useCallback(async () => {
    const current = optionsRef.current
    if (!current.token) return
    const dispatchModule = dispatchModuleRef.current ?? (dispatchModuleRef.current = import('./outboxDispatch'))
    const { DISPATCH } = await dispatchModule
    await drainQueue({
      token: current.token,
      now: Date.now,
      getQueue: () => pendingOpsRef.current,
      isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
      getRecentlyCompleted: () => recentlyCompletedOpsRef.current,
      getEditingPendingId: () => editingPendingIdRef.current,
      getBackoffUntil: () => syncBackoffUntilRef.current,
      getBackoffAttempt: () => backoffAttemptRef.current,
      setBackoffAttempt: attempt => { backoffAttemptRef.current = attempt },
      getLastUnlockedTime: () => current.lastUnlockedTimeRef.current,
      isSyncing: () => isSyncingRef.current,
      mutateQueue,
      resolveDispatch: op => DISPATCH[`${op.entity}:${op.type}`],
      setSyncing: value => {
        isSyncingRef.current = value
        if (mountedRef.current) setIsBackgroundSyncing(value)
      },
      setActiveSyncId: id => {
        if (mountedRef.current) setActiveSyncId(id)
      },
      setActiveSyncOpId: id => {
        activeSyncOpIdRef.current = id
      },
      setError: current.setError,
      setBackoff: until => {
        syncBackoffUntilRef.current = until
        if (mountedRef.current) setSyncBackoffUntil(until)
      },
      addRecentlyCompleted: op => {
        const next = [...recentlyCompletedOpsRef.current, op]
        recentlyCompletedOpsRef.current = next
        if (mountedRef.current) setRecentlyCompletedOps(next)
      },
      removeRecentlyCompleted: ids => {
        const next = recentlyCompletedOpsRef.current.filter(op => !ids.has(op.id))
        recentlyCompletedOpsRef.current = next
        if (mountedRef.current) setRecentlyCompletedOps(next)
      },
      clearRecentlyCompleted: () => {
        recentlyCompletedOpsRef.current = []
        if (mountedRef.current) setRecentlyCompletedOps([])
      },
      addFailedOp: op => {
        // Terminal for this attempt: release the snapshot so it can never be mistaken for a later
        // edit's "before" state. A retry of this op still has its own persisted payload snapshot.
        releaseUndoSnapshot(undoSnapshotsRef.current, op.entity, op.targetId)
        if (mountedRef.current) setFailedOps(previous => {
          const next = [...previous, op]
          failedOpsRef.current = next
          return next
        })
      },
      getSyncSuccessToast,
      buildUndoAction: createUndo,
      remapUndoSnapshot: (entity, fromTargetId, toTargetId) => {
        remapUndoSnapshotTarget(undoSnapshotsRef.current, entity, fromTargetId, toTargetId)
      },
      emitToast: (copy, action) => {
        if (!mountedRef.current) return
        const now = Date.now()
        const showAt = Math.max(now, nextToastAtRef.current)
        nextToastAtRef.current = showAt + TOAST_STAGGER_MS
        window.setTimeout(() => current.showToast(copy.message, copy.title, copy.tone, action), showAt - now)
      },
      emitFailureToast: (op, err) => {
        if (!mountedRef.current) return
        // Quote the server's reason. A bulk move is atomic, so one stale row rejects the whole
        // batch; without the reason the user sees every row snap back and cannot tell why.
        const reason = err instanceof Error && err.message.trim() ? ` ${err.message.trim()}` : ''
        void triggerHaptic([25, 45, 25])
        current.showToast(`Couldn't sync ${describeFailedOp(op)} — removed from queue.${reason}`, 'Sync Failed', 'error', {
          label: 'View',
          icon: Eye,
          onAction: () => current.onViewFailedOps?.(),
        })
      },
      onAuthError: current.onAuthError,
      onLockError: () => {
        syncBackoffUntilRef.current = 0
        if (mountedRef.current) setSyncBackoffUntil(0)
        current.onLockError()
      },
      shouldRefresh: current.shouldRefresh ?? (successfulOps => successfulOps.some(({ op }) =>
        op.entity !== 'settings' || !['darkMode', 'hideSensitive', 'summarySeen', 'selectedPeriod'].includes(op.targetId)
      )),
      refresh: current.refresh,
      onSettled: () => {
        if (!mountedRef.current) return
        setActiveSyncId(null)
        setDeletingId(null)
      },
      reTrigger: () => processQueueRef.current(),
    })
  }, [createUndo, mutateQueue])

  useEffect(() => {
    processQueueRef.current = () => { void processQueue() }
  }, [processQueue])

  useEffect(() => {
    if (!options.token || (pendingOps.length === 0 && recentlyCompletedOps.length === 0)) return
    if (editingPendingId) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    if (Date.now() < syncBackoffUntil) {
      const timer = window.setTimeout(() => {
        syncBackoffUntilRef.current = 0
        setSyncBackoffUntil(0)
      }, syncBackoffUntil - Date.now())
      return () => window.clearTimeout(timer)
    }
    void processQueue()
  }, [options.token, pendingOps, recentlyCompletedOps, syncBackoffUntil, editingPendingId, processQueue])

  useEffect(() => {
    const handleOnline = () => {
      syncBackoffUntilRef.current = 0
      setSyncBackoffUntil(0)
      // Connectivity returning is new information, so the escalated wait built up while
      // offline must not be charged to the first attempt after it.
      backoffAttemptRef.current = 0
      processQueueRef.current()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const discardFailedOp = useCallback((id: string) => {
    setFailedOps(previous => {
      const next = previous.filter(op => op.id !== id)
      failedOpsRef.current = next
      return next
    })
  }, [])
  const discardAllFailedOps = useCallback(() => {
    failedOpsRef.current = []
    setFailedOps([])
  }, [])
  const mutateFailedOps = useCallback((updater: (previous: QueuedOp[]) => QueuedOp[]) => {
    setFailedOps(previous => {
      const next = updater(previous)
      failedOpsRef.current = next
      return next
    })
  }, [])
  const getPendingOps = useCallback(() => pendingOpsRef.current, [])
  const getActiveOps = useCallback(
    () => [...pendingOpsRef.current, ...recentlyCompletedOpsRef.current],
    [],
  )
  const getFailedOps = useCallback(() => failedOpsRef.current, [])
  const reset = useCallback(() => {
    mutateQueue(() => [])
    failedOpsRef.current = []
    setFailedOps([])
    recentlyCompletedOpsRef.current = []
    setRecentlyCompletedOps([])
    setEditingPendingId(null)
    setDeletingId(null)
    syncBackoffUntilRef.current = 0
    setSyncBackoffUntil(0)
    backoffAttemptRef.current = 0
    undoSnapshotsRef.current.clear()
  }, [mutateQueue, setEditingPendingId])
  const activeOps = useMemo(() => [...pendingOps, ...recentlyCompletedOps], [pendingOps, recentlyCompletedOps])

  return {
    pendingOps,
    failedOps,
    activeOps,
    isBackgroundSyncing,
    activeSyncId,
    deletingId,
    syncCountdownMs,
    editingPendingId,
    enqueue,
    mutateQueue,
    snapshotForUndo: captureUndo,
    processQueue,
    setBackgroundSyncing: setIsBackgroundSyncing,
    setDeletingId,
    setEditingPendingId,
    discardFailedOp,
    discardAllFailedOps,
    mutateFailedOps,
    getPendingOps,
    getActiveOps,
    getFailedOps,
    reset,
  }
}
