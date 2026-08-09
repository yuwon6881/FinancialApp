import type { Dispatch, SetStateAction } from 'react'
import type { SavingsGoal, Transaction, WishlistItem } from '../../types'
import { CACHE_KEYS, setCachedJSON } from '../../lib/cache'
import { createFinalId, createLocalNumericId, createLocalWishlistId, type OutboxPayload } from '../../lib/outbox'
import { triggerHaptic } from '../../lib/haptics'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { AppDialogs } from '../useAppDialogs'

interface WishlistSavingsActionDependencies {
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  allWishlist: WishlistItem[]
  allSavingsGoals: SavingsGoal[]
  currency: string
  editingPendingId: string | null
  guardSensitive: () => boolean
  showToast: AppDialogs['showToast']
  setConfirmModalData: AppDialogs['setConfirmModalData']
  setEditingPendingId: UseOutboxResult['setEditingPendingId']
  enqueue: UseOutboxResult['enqueue']
  mutateQueue: UseOutboxResult['mutateQueue']
  snapshotForUndo: UseOutboxResult['snapshotForUndo']
  setSavingsGoals: Dispatch<SetStateAction<SavingsGoal[]>>
  beginDirectSync: (ids: Array<string | number>) => void
  endDirectSync: (ids: Array<string | number>) => void
  getGoal: (id: number) => SavingsGoal | undefined
  getActiveGoalIds: () => number[]
  addPendingLedgerTransaction: (transaction: Transaction) => void
  replacePendingLedgerTransaction: (pendingId: string, transaction: Transaction) => void
  removePendingLedgerTransaction: (id: string) => void
  setDeletingTransactionId: (id: string | null) => void
  refreshAll: () => Promise<void>
}

const toOutboxPayload = (value: object): OutboxPayload => ({ ...value })

export function createWishlistSavingsActions(deps: WishlistSavingsActionDependencies) {
  const {
    wishlist,
    savingsGoals,
    allWishlist,
    allSavingsGoals,
    currency,
    editingPendingId,
    guardSensitive,
    showToast,
    setConfirmModalData,
    setEditingPendingId,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setSavingsGoals,
    beginDirectSync,
    endDirectSync,
    getGoal,
    getActiveGoalIds,
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    removePendingLedgerTransaction,
    setDeletingTransactionId,
    refreshAll,
  } = deps

  const handleAddWishlistItem = (newWish: Partial<WishlistItem>) => {
    const placeholderId = String(createLocalWishlistId())
    const payload = {
      name: newWish.name || '',
      price: newWish.price || 0,
      priority: newWish.priority || 'Medium',
      isPurchased: false,
      createdAt: new Date().toISOString(),
      isActive: newWish.isActive ?? false,
    }
    mutateQueue(previous => enqueue(previous, 'wishlistItem', 'add', placeholderId, payload))
  }

  const handleUpdateWishlistItem = (id: number, updatedWish: WishlistItem) => {
    if (!guardSensitive()) return
    const previousItem = allWishlist.find(item => String(item.id) === String(id))
    snapshotForUndo('wishlistItem', String(id), previousItem)
    mutateQueue(previous => enqueue(previous, 'wishlistItem', 'update', String(id), {
      ...toOutboxPayload(updatedWish),
      undoSnapshot: previousItem,
    }))
    if (String(id) === editingPendingId) setEditingPendingId(null)
  }

  const handleDeleteWishlistItem = (id: number) => {
    void triggerHaptic(30)
    const item = allWishlist.find(wish => String(wish.id) === String(id))
    snapshotForUndo('wishlistItem', String(id), item)
    mutateQueue(previous => enqueue(previous, 'wishlistItem', 'delete', String(id), {
      name: item?.name,
      undoSnapshot: item,
    }))
  }

  const requestDeleteWishlistItem = (id: number) => {
    if (!guardSensitive()) return
    const item = wishlist.find(wish => wish.id === id)
    setConfirmModalData({
      title: 'Delete Wishlist Item',
      message: `Delete "${item?.name || 'this wishlist item'}"? This removes the item from your wishlist.`,
      confirmText: 'Delete',
      onConfirm: () => { handleDeleteWishlistItem(id) },
    })
  }

  const handlePurchaseWishlistItem = (id: number, customDate?: string) => {
    if (!guardSensitive()) return
    const item = allWishlist.find(wish => String(wish.id) === String(id))
    const now = new Date()
    const date = customDate || now.toLocaleDateString('en-CA')
    const postedAt = customDate ? `${customDate}T12:00:00.000Z` : now.toISOString()
    const purchaseTransactionId = createFinalId('transaction')
    mutateQueue(previous => enqueue(previous, 'wishlistItem', 'purchase', String(id), item ? {
      name: item.name,
      price: item.price,
      date,
      postedAt,
      purchaseTransactionId,
    } : undefined))
  }

  const handleUnpurchaseWishlistItem = (id: number) => {
    if (!guardSensitive()) return
    const item = allWishlist.find(wish => String(wish.id) === String(id))
    mutateQueue(previous => enqueue(previous, 'wishlistItem', 'unpurchase', String(id), item ? {
      purchaseTransactionId: item.purchaseTransactionId,
      name: item.name,
      price: item.price,
      date: item.purchasedAt?.slice(0, 10),
    } : undefined))
  }

  const commitSavingsGoals = (goals: SavingsGoal[]) => {
    setSavingsGoals(goals)
    setCachedJSON(CACHE_KEYS.savingsGoals, goals)
  }

  const commitSavingsGoal = (goal: SavingsGoal) => {
    setSavingsGoals(previous => {
      const next = previous.some(item => item.id === goal.id)
        ? previous.map(item => item.id === goal.id ? goal : item)
        : [...previous, goal]
      setCachedJSON(CACHE_KEYS.savingsGoals, next)
      return next
    })
  }

  const handleAddSavingsGoal = (goal: Partial<SavingsGoal>) => {
    const placeholderId = String(createLocalNumericId())
    const payload = {
      name: goal.name || '',
      targetAmount: goal.targetAmount || 0,
      earmarkedAmount: 0,
      targetDate: goal.targetDate || '',
      priority: goal.priority || 'Medium',
      status: 'active',
      isRecurring: goal.isRecurring ?? false,
      recurrenceMonths: goal.recurrenceMonths ?? 12,
      createdAt: new Date().toISOString(),
    }
    mutateQueue(previous => enqueue(previous, 'savingsGoal', 'add', placeholderId, payload))
  }

  const handleUpdateSavingsGoal = (id: number, updatedGoal: SavingsGoal) => {
    if (!guardSensitive()) return
    snapshotForUndo('savingsGoal', String(id), allSavingsGoals.find(goal => String(goal.id) === String(id)))
    mutateQueue(previous => enqueue(previous, 'savingsGoal', 'update', String(id), toOutboxPayload(updatedGoal)))
    if (String(id) === editingPendingId) setEditingPendingId(null)
  }

  const handleDeleteSavingsGoal = (id: number) => {
    void triggerHaptic(30)
    const goal = allSavingsGoals.find(item => String(item.id) === String(id))
    snapshotForUndo('savingsGoal', String(id), goal)
    mutateQueue(previous => enqueue(previous, 'savingsGoal', 'delete', String(id), {
      name: goal?.name,
      undoSnapshot: goal,
    }))
  }

  const requestDeleteSavingsGoal = async (id: number) => {
    if (!guardSensitive()) return
    const { describeDeleteGoal } = await import('../savingsGoalActions')
    setConfirmModalData({
      ...describeDeleteGoal(savingsGoals.find(goal => goal.id === id), currency),
      onConfirm: () => { handleDeleteSavingsGoal(id) },
    })
  }

  const savingsGoalDependencies = () => ({
    currency,
    commitGoals: commitSavingsGoals,
    commitGoal: commitSavingsGoal,
    getGoalName: (id: number) => allSavingsGoals.find(goal => goal.id === id)?.name,
    getGoal,
    beginDirectSync,
    endDirectSync,
    getActiveGoalIds,
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    removePendingLedgerTransaction,
    setDeletingTransactionId,
    refreshAll,
    showToast,
  })

  /** Resolves to the rejection message when the move was refused, else null. */
  const handleContributeToSavingsGoal = async (id: number, amount: number): Promise<string | null> => {
    if (!guardSensitive()) return null
    beginDirectSync([id])
    try {
      const { contributeToGoal } = await import('../savingsGoalActions')
      return await contributeToGoal(savingsGoalDependencies(), id, amount)
    } finally {
      endDirectSync([id])
    }
  }

  const handleFundSavingsGoalsForCycle = async () => {
    if (!guardSensitive()) return
    const syncIds = ['savings-goals-fund', ...getActiveGoalIds()]
    beginDirectSync(syncIds)
    try {
      const { fundGoalsForCycle } = await import('../savingsGoalActions')
      await fundGoalsForCycle(savingsGoalDependencies())
    } finally {
      endDirectSync(syncIds)
    }
  }

  const handleCompleteSavingsGoal = async (id: number) => {
    if (!guardSensitive()) return
    beginDirectSync([id])
    try {
      const { completeGoal } = await import('../savingsGoalActions')
      await completeGoal(savingsGoalDependencies(), id)
    } finally {
      endDirectSync([id])
    }
  }

  const requestCompleteSavingsGoal = async (id: number) => {
    if (!guardSensitive()) return
    const { describeCompleteGoal } = await import('../savingsGoalActions')
    setConfirmModalData({
      ...describeCompleteGoal(savingsGoals.find(goal => goal.id === id), currency),
      onConfirm: () => { void handleCompleteSavingsGoal(id) },
    })
  }

  return {
    handleAddWishlistItem,
    handleUpdateWishlistItem,
    handleDeleteWishlistItem,
    requestDeleteWishlistItem,
    handlePurchaseWishlistItem,
    handleUnpurchaseWishlistItem,
    handleAddSavingsGoal,
    handleUpdateSavingsGoal,
    handleDeleteSavingsGoal,
    requestDeleteSavingsGoal,
    handleContributeToSavingsGoal,
    handleFundSavingsGoalsForCycle,
    requestCompleteSavingsGoal,
  }
}
