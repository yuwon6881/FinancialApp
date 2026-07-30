import type { Dispatch, SetStateAction } from 'react'
import type { SavingsGoal, WishlistItem } from '../../types'
import { CACHE_KEYS, setCachedJSON } from '../../lib/cache'
import { createLocalNumericId, createLocalWishlistId, type OutboxPayload } from '../../lib/outbox'
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
      message: `Delete "${item?.name || 'this wishlist item'}"? This removes the savings goal from your wishlist.`,
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
    mutateQueue(previous => enqueue(previous, 'wishlistItem', 'purchase', String(id), item ? {
      name: item.name,
      price: item.price,
      date,
      postedAt,
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
    mutateQueue(previous => enqueue(previous, 'savingsGoal', 'delete', String(id), { name: goal?.name }))
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
    showToast,
  })

  const handleContributeToSavingsGoal = async (id: number, amount: number) => {
    if (!guardSensitive()) return
    const { contributeToGoal } = await import('../savingsGoalActions')
    await contributeToGoal(savingsGoalDependencies(), id, amount)
  }

  const handleFundSavingsGoalsForCycle = async () => {
    if (!guardSensitive()) return
    const { fundGoalsForCycle } = await import('../savingsGoalActions')
    await fundGoalsForCycle(savingsGoalDependencies())
  }

  const handleCompleteSavingsGoal = async (id: number) => {
    if (!guardSensitive()) return
    const { completeGoal } = await import('../savingsGoalActions')
    await completeGoal(savingsGoalDependencies(), id)
  }

  const requestCompleteSavingsGoal = async (id: number) => {
    if (!guardSensitive()) return
    const { describeCompleteGoal } = await import('../savingsGoalActions')
    setConfirmModalData({
      ...describeCompleteGoal(savingsGoals.find(goal => goal.id === id)),
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
