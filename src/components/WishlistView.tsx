import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listContainerVariants, listItemVariants } from '../lib/animations'
import type { WishlistItem } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { SwipeableRow } from './ui/SwipeableRow'
import { BottomSheet } from './ui/BottomSheet'
import { CycleSkeleton } from './ui/Skeleton'
import { Card } from './ui/Card'
import { RowSyncBadge } from './ui/RowSyncBadge'
import { formatCurrencyVal, maskCurrencyInput } from '../lib/utils'
import { useFormDraft } from '../lib/useFormDraft'
import { useAutoOpenModal } from '../lib/useAutoOpenModal'
import { useSyncStatus } from '../lib/useOptimisticList'
import { Button } from './ui/Button'
import { SmartAmountInput } from './ui/SmartAmountInput'
import {
  Wallet,
  PiggyBank,
  Plus, 
  Trash2, 
  Clock,
  CheckCircle2,
  Target,
  Edit2,
  Trophy,
  ArrowUpRight
} from 'lucide-react'

interface WishlistViewProps {
  wishlist: WishlistItem[]
  rewardsBalance: number
  rewardsTarget: number
  pastThreeMonthsRewardsAverage: number
  hasRewardsHistory: boolean
  currency: string
  hideSensitive: boolean
  onAddItem: (item: Partial<WishlistItem>) => Promise<void> | void
  onUpdateItem: (id: number, item: WishlistItem) => Promise<void> | void
  onDeleteItem: (id: number) => Promise<void> | void
  onPurchaseItem: (id: number) => Promise<void> | void
  formatSensitive: (val: number) => React.ReactNode
  autoOpenAddModal?: boolean
  onResetAutoOpen?: () => void
  onNavigateToLedger?: (options: {
    category?: string | null
    date?: string | null
    txType?: 'inflow' | 'outflow' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
  }) => void
  activeSyncId?: string | null
  deletingId?: string | null
  isSwitchingCycle?: boolean
  // Signals to the parent's drain loop which item is being edited, so the
  // corresponding queued op isn't dispatched while the edit modal is open.
  onStartEditPending?: (id: string | null) => void
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: number; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  wishlist,
  rewardsBalance,
  rewardsTarget,
  pastThreeMonthsRewardsAverage,
  hasRewardsHistory,
  currency,
  hideSensitive,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onPurchaseItem,
  formatSensitive,
  autoOpenAddModal,
  onResetAutoOpen,
  onNavigateToLedger,
  activeSyncId = null,
  deletingId = null,
  isSwitchingCycle = false,
  onStartEditPending,
  aiDraft = null,
  aiEditDraft = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed
}) => {
  const { isSyncing: isItemSyncing, isDeleting: isItemDeleting } = useSyncStatus(wishlist, activeSyncId, deletingId)

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form states
  const [nameInput, setNameInput] = useState('')
  const [priceInput, setPriceInput] = useState('')

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPriceInput(maskCurrencyInput(e.target.value, priceInput));
  };
  const [priorityInput, setPriorityInput] = useState('Medium')
  const [isActiveInput, setIsActiveInput] = useState(false)

  const applyAiWishlistFields = (fields: Record<string, unknown>) => {
    const getString = (key: string) => {
      const value = fields[key]
      return typeof value === 'string' && value.trim() ? value.trim() : null
    }
    const getNumber = (key: string) => {
      const value = fields[key]
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      }
      return null
    }

    const nextName = getString('name')
    if (nextName !== null) setNameInput(nextName)
    const nextPrice = getNumber('price')
    if (nextPrice !== null) setPriceInput(Math.abs(nextPrice).toFixed(2))
    const nextPriority = getString('priority')
    if (nextPriority === 'High' || nextPriority === 'Medium' || nextPriority === 'Low') setPriorityInput(nextPriority)
    if (typeof fields.isActive === 'boolean') setIsActiveInput(fields.isActive)
  }

  useEffect(() => {
    if (!aiDraft) return
    setEditingItem(null)
    setNameInput('')
    setPriceInput('')
    setPriorityInput('Medium')
    setIsActiveInput(wishlist.filter(w => !w.isPurchased).length === 0)
    applyAiWishlistFields(aiDraft.fields)
    setShowAddModal(true)
    onAiDraftConsumed?.()
  }, [aiDraft?.nonce])

  useEffect(() => {
    if (!aiEditDraft) return
    if (hideSensitive) {
      onAiEditDraftConsumed?.()
      return
    }
    const item = wishlist.find(w => Number(w.id) === Number(aiEditDraft.id))
    if (!item) {
      onAiEditDraftConsumed?.()
      return
    }
    setEditingItem(item)
    setNameInput(item.name)
    setPriceInput(item.price.toFixed(2))
    setPriorityInput(item.priority)
    setIsActiveInput(item.isActive)
    applyAiWishlistFields(aiEditDraft.changes)
    onStartEditPending?.(String(item.id))
    setShowEditModal(true)
    onAiEditDraftConsumed?.()
  }, [aiEditDraft?.nonce])

  // Keep in-progress modal fields across an interrupted session (see
  // useFormDraft) -- reopens the right modal with what the user had typed.
  const { clearDraft: clearAddDraft } = useFormDraft(
    'wishlist-add',
    showAddModal,
    { nameInput, priceInput, priorityInput, isActiveInput },
    (draft) => {
      setNameInput(draft.nameInput)
      setPriceInput(draft.priceInput)
      setPriorityInput(draft.priorityInput)
      setIsActiveInput(draft.isActiveInput)
      setShowAddModal(true)
    }
  )

  const { clearDraft: clearEditDraft } = useFormDraft(
    'wishlist-edit',
    showEditModal,
    { editingItemId: editingItem?.id ?? null, nameInput, priceInput, priorityInput, isActiveInput },
    (draft) => {
      if (draft.editingItemId == null) return
      // If the item was deleted elsewhere while this device was logged out,
      // just skip reopening -- the stale entry is harmless and gets
      // overwritten the next time this modal opens for any item.
      const found = wishlist.find(w => String(w.id) === String(draft.editingItemId))
      if (!found) return
      setEditingItem(found)
      setNameInput(draft.nameInput)
      setPriceInput(draft.priceInput)
      setPriorityInput(draft.priorityInput)
      setIsActiveInput(draft.isActiveInput)
      onStartEditPending?.(String(draft.editingItemId))
      setShowEditModal(true)
    }
  )

  // Separate active (hero) item and queued items
  const activeItem = useMemo(() => {
    return wishlist.find(w => w.isActive && !w.isPurchased) || 
           wishlist.filter(w => !w.isPurchased).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  }, [wishlist])

  const queuedItems = useMemo(() => {
    if (!activeItem) return wishlist.filter(w => !w.isPurchased)
    return wishlist.filter(w => !w.isPurchased && w.id !== activeItem.id)
  }, [wishlist, activeItem])

  const purchasedItems = useMemo(() => {
    return wishlist.filter(w => w.isPurchased).sort((a,b) => {
      const dateA = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0
      const dateB = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0
      return dateB - dateA
    })
  }, [wishlist])

  // Stats
  const totalCost = useMemo(() => {
    return wishlist.filter(w => !w.isPurchased).reduce((sum, item) => sum + item.price, 0)
  }, [wishlist])

  const affordableCount = useMemo(() => {
    return wishlist.filter(w => !w.isPurchased && rewardsBalance >= w.price).length
  }, [wishlist, rewardsBalance])

  // Calculation for timeline prediction
  const getTimelineString = (itemPrice: number, rate: number) => {
    const remaining = itemPrice - rewardsBalance
    if (remaining <= 0) return 'Available Now! 🎉'
    if (rate <= 0) return 'N/A'
    
    const months = remaining / rate
    const days = Math.ceil(months * 30)
    
    const today = new Date()
    const targetDate = new Date(today.setDate(today.getDate() + days))
    const formattedDate = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    
    if (days < 30) {
      return `~${days} Days (${formattedDate})`
    }
    const roundedMonths = (days / 30).toFixed(1)
    return `~${roundedMonths} Months (${formattedDate})`
  }

   const handleOpenAddModal = () => {
    setNameInput('')
    setPriceInput('')
    setPriorityInput('Medium')
    setIsActiveInput(wishlist.filter(w => !w.isPurchased).length === 0)
    setShowAddModal(true)
  }

  // Deferred so the sheet's entrance animation doesn't start on the contended
  // tab-switch/mount frame (which made the slide occasionally skip). See
  // lib/useAutoOpenModal.
  useAutoOpenModal(autoOpenAddModal, handleOpenAddModal, onResetAutoOpen)

  const handleOpenEditModal = (item: WishlistItem) => {
    if (hideSensitive) return
    setEditingItem(item)
    setNameInput(item.name)
    setPriceInput(item.price.toFixed(2))
    setPriorityInput(item.priority)
    setIsActiveInput(item.isActive)
    // Notify the parent drain loop so this item's queued op is held until the
    // modal closes (mirrors the protection transaction edits already have).
    onStartEditPending?.(String(item.id))
    setShowEditModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setNameInput('')
    setPriceInput('')
    setPriorityInput('Medium')
    setIsActiveInput(false)
    clearAddDraft()
    setErrors({})
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingItem(null)
    setNameInput('')
    setPriceInput('')
    setPriorityInput('Medium')
    setIsActiveInput(false)
    clearEditDraft()
    setErrors({})
    // Release the drain-loop hold now that the user has finished (or cancelled)
    // editing.
    onStartEditPending?.(null)
  }

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!nameInput.trim()) {
      newErrors.name = 'Goal name is required.'
    }
    const price = parseFloat(priceInput)
    if (!priceInput.trim()) {
      newErrors.price = 'Price is required.'
    } else if (isNaN(price) || price <= 0) {
      newErrors.price = 'Please enter a valid price greater than 0.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    const newGoal = {
      name: nameInput,
      price,
      priority: priorityInput,
      isActive: isActiveInput
    }
    closeAddModal()
    await onAddItem(newGoal)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    const newErrors: Record<string, string> = {}
    if (!nameInput.trim()) {
      newErrors.name = 'Goal name is required.'
    }
    const price = parseFloat(priceInput)
    if (!priceInput.trim()) {
      newErrors.price = 'Price is required.'
    } else if (isNaN(price) || price <= 0) {
      newErrors.price = 'Please enter a valid price greater than 0.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    const cleanItem: Omit<WishlistItem, 'isPendingSync'> & { isPendingSync?: boolean } = { ...editingItem }
    delete cleanItem.isPendingSync
    const updatedGoal = {
      ...cleanItem,
      name: nameInput,
      price,
      priority: priorityInput,
      isActive: isActiveInput
    }
    const targetId = editingItem.id
    closeEditModal()
    await onUpdateItem(targetId, updatedGoal)
  }

  const handleToggleActive = async (item: WishlistItem) => {
    if (hideSensitive) return
    await onUpdateItem(item.id, {
      ...item,
      isActive: true
    })
  }

  return (
    <div className="space-y-6 soft-rise">
      {/* Top Banner Ribbon — rewardsBalance/rewardsTarget are cycle-scoped, so
          show a skeleton while a new cycle's dashboard data is loading rather
          than briefly flashing the previous cycle's numbers. */}
      {isSwitchingCycle ? (
        <CycleSkeleton variant="wishlist" />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card
          onClick={() => onNavigateToLedger?.({ category: 'Rewards', showAllCycles: true })}
          className="group flex cursor-pointer items-center justify-between overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-md"
        >
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Rewards Balance</span>
            <span className="text-xl font-black text-foreground mt-1 block">{formatSensitive(rewardsBalance)}</span>
            <span className="mt-1 flex items-center gap-0.5 text-[9px] font-semibold text-blue-500">
              View reward history <ArrowUpRight className="size-2.5" />
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-300">
            <Wallet className="size-5" />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-5 transition-transform duration-300 hover:-translate-y-0.5">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Goals Cost</span>
            <span className="text-xl font-black text-foreground mt-1 block">{formatSensitive(totalCost)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-500/10 text-slate-500">
            <Target className="size-5" />
          </div>
        </Card>

        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/8 to-card p-5 shadow-xs transition-transform duration-300 hover:-translate-y-0.5">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Claimable Goals</span>
            <span className="text-xl font-black text-foreground mt-1 block">{affordableCount} Items</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Trophy className="size-5" />
          </div>
        </div>
      </div>
      )}

      {/* Hero Card & Queue Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Active Focus Item (Hero Card) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Target className="size-4 text-blue-500" />
              Your focus
            </h3>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenAddModal}
              className="hidden items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-600/10 transition hover:bg-blue-700 sm:flex"
            >
              <Plus className="size-3.5" /> Add Goal
            </motion.button>
          </div>

          {activeItem ? (
            (() => {
              const pct = Math.max(0, Math.min(100, (rewardsBalance / activeItem.price) * 100))
              const canAfford = rewardsBalance >= activeItem.price

              return (
                <div 
                  className={`p-6 rounded-2xl bg-card border transition-all duration-300 flex flex-col justify-between ${
                    canAfford 
                      ? 'border-blue-500/50 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/10' 
                      : 'border-border/60 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header — name + status badge, mirrors subscription card top */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          {activeItem.name}
                          {isItemDeleting(activeItem.id) ? (
                            <RowSyncBadge state="deleting" entityLabel="item" />
                          ) : (isItemSyncing(activeItem.id) || activeItem.isPendingSync) ? (
                            <RowSyncBadge state={isItemSyncing(activeItem.id) ? 'syncing' : 'pending'} entityLabel="item" />
                          ) : null}
                        </h2>
                        <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                          activeItem.priority === 'High' 
                            ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                            : activeItem.priority === 'Medium'
                            ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                            : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                        }`}>
                          {activeItem.priority} Priority
                        </span>
                      </div>
                      {canAfford ? (
                        <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1 shrink-0">
                          <PiggyBank className="size-3.5" /> Ready to Claim
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="size-3.5" /> Saving In Progress
                        </span>
                      )}
                    </div>

                    {/* Price — large figure, mirrors subscription card amount */}
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-foreground">{formatSensitive(activeItem.price)}</span>
                      <span className="text-xs text-muted-foreground">goal</span>
                    </div>

                    {/* Progress details */}
                    <div className="mt-6 space-y-2 border-t border-border/30 pt-4 text-xs">
                      <div className="flex justify-between text-xs font-bold text-muted-foreground">
                        <span>Funded</span>
                        <span className={canAfford ? 'text-blue-500' : 'text-foreground'}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                        <span>{formatSensitive(rewardsBalance)} saved</span>
                        <span>{formatSensitive(activeItem.price)} target</span>
                      </div>
                    </div>

                    {/* Predictor Ribbon */}
                    {!canAfford && (
                      <div className="mt-4 grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border/30">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-500">Optimistic Projection</span>
                          <span className="text-[11px] font-bold text-foreground block">
                            {getTimelineString(activeItem.price, rewardsTarget > 0 ? rewardsTarget : 100)}
                          </span>
                          <span className="text-[9px] text-muted-foreground block font-medium">
                            Based on target budget (
                            <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block' : 'inline-block'}>
                              {formatCurrencyVal(rewardsTarget, currency)}
                            </span>
                            /mo)
                          </span>
                        </div>
                        <div className="space-y-1 border-l border-border/30 pl-3">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-violet-500">Realistic Projection</span>
                          <span className="text-[11px] font-bold text-foreground block">
                            {hasRewardsHistory 
                              ? getTimelineString(activeItem.price, pastThreeMonthsRewardsAverage)
                              : 'N/A'
                            }
                          </span>
                          <span className="text-[9px] text-muted-foreground block font-medium">
                            {hasRewardsHistory ? (
                              <>
                                Based on past 3-mo savings (
                                <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block' : 'inline-block'}>
                                  {formatCurrencyVal(pastThreeMonthsRewardsAverage, currency)}
                                </span>
                                /mo)
                              </>
                            ) : (
                              'No past savings history'
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions — matches subscription card footer style */}
                  <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between border-t border-border/30 pt-4 gap-3 sm:gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onPurchaseItem(activeItem.id)}
                      disabled={!canAfford}
                      className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition duration-200 cursor-pointer w-full sm:w-auto ${
                        canAfford
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      <PiggyBank className="size-3.5" />
                      {canAfford ? 'Claim Reward' : <>Need {formatSensitive(activeItem.price - rewardsBalance)} More</>}
                    </motion.button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="ghost"
                        onClick={() => handleOpenEditModal(activeItem)}
                        disabled={hideSensitive}
                        title={hideSensitive ? 'Unhide balances to edit' : 'Edit goal'}
                        className="flex-1 sm:flex-none justify-center py-2.5"
                      >
                        <Edit2 className="size-3.5" /> Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => onDeleteItem(activeItem.id)}
                        disabled={hideSensitive}
                        title={hideSensitive ? 'Unhide balances to delete' : 'Delete goal'}
                        className="flex-1 sm:flex-none justify-center py-2.5"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <Card className="p-8 border-dashed text-center flex flex-col items-center justify-center min-h-[300px]">
              <Target className="size-10 text-muted-foreground/60 mb-2" />
              <h4 className="font-bold text-foreground text-sm">No Active Focus Item</h4>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">Set a goal from your wishlist queue below or create a new target to track savings progress.</p>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenAddModal}
                className="mt-4 flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-md shadow-blue-600/10 transition cursor-pointer"
              >
                <Plus className="size-3.5" /> Add Goal
              </motion.button>
            </Card>
          )}
        </div>

        {/* Queued & Wishlist Items List */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 px-1">
            <Clock className="size-4 text-blue-500" />
            Up next <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{queuedItems.length}</span>
          </h3>

          <motion.div 
            initial="hidden" animate="show"
            variants={listContainerVariants}
            className="space-y-3 max-h-[460px] overflow-y-auto pr-1"
          >
            <AnimatePresence>
            {queuedItems.length > 0 ? (
              queuedItems.map((item, idx) => {
                const pct = Math.max(0, Math.min(100, (rewardsBalance / item.price) * 100))
                const canAfford = rewardsBalance >= item.price
                const isBusy = isItemDeleting(item.id) || isItemSyncing(item.id) || item.isPendingSync

                return (
                  <motion.div variants={listItemVariants} key={item.id}>
                  <SwipeableRow
                    hint={idx === 0}
                    disabled={isBusy}
                    className={`rounded-xl border shadow-xs transition duration-200 group ${
                      canAfford ? 'border-blue-500/30' : 'border-border/60 hover:border-blue-500/20'
                    }`}
                    contentClassName="p-4"
                    actionsWidth={174}
                    actions={
                      <>
                        <button
                          onClick={() => handleToggleActive(item)}
                          disabled={isBusy}
                          className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white text-[10px] font-bold active:bg-blue-600 transition disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Target className="size-3.5" />
                          Focus
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          disabled={hideSensitive || isBusy}
                          className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-600 text-white text-[10px] font-bold active:bg-blue-700 transition disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Edit2 className="size-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          disabled={isBusy || hideSensitive}
                          className="flex-1 flex flex-col items-center justify-center gap-1 bg-orange-600 text-white text-[10px] font-bold active:bg-orange-700 transition disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </>
                    }
                    desktopActions={
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(item)}
                          disabled={isBusy || hideSensitive}
                          title={hideSensitive ? 'Unhide balances to edit' : undefined}
                        >
                          Focus
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(item)}
                          disabled={hideSensitive || isBusy}
                          title={hideSensitive ? 'Unhide balances to edit' : undefined}
                        >
                          <Edit2 className="size-3" /> Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteItem(item.id)}
                          disabled={isBusy || hideSensitive}
                          title={hideSensitive ? 'Unhide balances to edit' : undefined}
                        >
                          <Trash2 className="size-3" /> Delete
                        </Button>
                      </>
                    }
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground text-xs truncate flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {isItemDeleting(item.id) ? (
                            <RowSyncBadge state="deleting" entityLabel="item" />
                          ) : (isItemSyncing(item.id) || item.isPendingSync) ? (
                            <RowSyncBadge state={isItemSyncing(item.id) ? 'syncing' : 'pending'} entityLabel="item" />
                          ) : null}
                        </h4>
                        {canAfford && (
                          <span className="size-1.5 rounded-full bg-blue-500 shrink-0" title="Ready to claim" />
                        )}
                      </div>
                      <div className="text-sm font-extrabold text-foreground">{formatSensitive(item.price)}</div>
                      <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </SwipeableRow>
                  </motion.div>
                )
              })
            ) : (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground">
                No items in the wishlist queue.
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* History Log / Purchased Items */}
      {purchasedItems.length > 0 && (
        <Card>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-4">
            <CheckCircle2 className="size-4 text-blue-500" />
            Milestones unlocked <span className="ml-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-500">{purchasedItems.length}</span>
          </h3>
          <div className="divide-y divide-border/30 text-xs font-semibold">
            {purchasedItems.map(item => (
              <div key={item.id} className="py-3 flex items-center justify-between text-foreground">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                    <CheckCircle2 className="size-3.5" />
                  </span>
                  <div>
                    <span className="font-bold block">{item.name}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Bought: {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-muted-foreground">{formatSensitive(item.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <BottomSheet
          isOpen={showAddModal}
          title="Add New Wish Goal"
          onClose={closeAddModal}
          maxWidthClassName="max-w-md"
        >
            <form noValidate onSubmit={handleSaveAdd} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-muted-foreground block mb-1">Goal Name *</label>
                <input 
                  type="text" 
                  value={nameInput}
                  onChange={e => {
                    setNameInput(e.target.value)
                    if (errors.name) {
                      setErrors(prev => ({ ...prev, name: '' }))
                    }
                  }}
                  placeholder="e.g. Mechanical Keyboard, Weekend Trip"
                  className={`w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium ${
                    errors.name 
                      ? 'border-destructive focus:ring-destructive' 
                      : 'border-border focus:ring-blue-500'
                  }`}
                />
                {errors.name && (
                  <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground block mb-1">Price ({currency}) *</label>
                  <SmartAmountInput 
                    type="text" 
                    value={priceInput}
                    onChange={e => {
                      handlePriceChange(e)
                      if (errors.price) {
                        setErrors(prev => ({ ...prev, price: '' }))
                      }
                    }}
                    placeholder="0.00"
                    className={`w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      errors.price 
                        ? 'border-destructive focus:ring-destructive' 
                        : 'border-border focus:ring-blue-500'
                    }`}
                  />
                  {errors.price && (
                    <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {errors.price}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Priority</label>
                  <CustomSelect 
                    value={priorityInput}
                    onChange={val => setPriorityInput(val)}
                    options={[
                      { value: 'High', label: 'High' },
                      { value: 'Medium', label: 'Medium' },
                      { value: 'Low', label: 'Low' }
                    ]}
                    className="w-full"
                  />
                </div>
              </div>



              <div className="flex items-center gap-2 py-1 select-none">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={isActiveInput}
                  onChange={e => setIsActiveInput(e.target.checked)}
                  className="size-3.5 border-border rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-muted-foreground font-medium cursor-pointer">Set as Active Focus Goal</label>
              </div>

              <div className="flex items-center gap-3 border-t border-border/30 pt-4 mt-6">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="flex-1 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold shadow-lg shadow-blue-500/25 transition cursor-pointer"
                >
                  Add Goal
                </motion.button>
              </div>
            </form>
        </BottomSheet>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <BottomSheet
          isOpen={showEditModal}
          title="Edit Wish Goal"
          onClose={closeEditModal}
          maxWidthClassName="max-w-md"
        >
            <form noValidate onSubmit={handleSaveEdit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-muted-foreground block mb-1">Goal Name *</label>
                <input 
                  type="text" 
                  value={nameInput}
                  onChange={e => {
                    setNameInput(e.target.value)
                    if (errors.name) {
                      setErrors(prev => ({ ...prev, name: '' }))
                    }
                  }}
                  className={`w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium ${
                    errors.name 
                      ? 'border-destructive focus:ring-destructive' 
                      : 'border-border focus:ring-blue-500'
                  }`}
                />
                {errors.name && (
                  <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground block mb-1">Price ({currency}) *</label>
                  <SmartAmountInput 
                    type="text" 
                    value={priceInput}
                    onChange={e => {
                      handlePriceChange(e)
                      if (errors.price) {
                        setErrors(prev => ({ ...prev, price: '' }))
                      }
                    }}
                    className={`w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      errors.price 
                        ? 'border-destructive focus:ring-destructive' 
                        : 'border-border focus:ring-blue-500'
                    }`}
                  />
                  {errors.price && (
                    <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {errors.price}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Priority</label>
                  <CustomSelect 
                    value={priorityInput}
                    onChange={val => setPriorityInput(val)}
                    options={[
                      { value: 'High', label: 'High' },
                      { value: 'Medium', label: 'Medium' },
                      { value: 'Low', label: 'Low' }
                    ]}
                    className="w-full"
                  />
                </div>
              </div>



              <div className="flex items-center gap-2 py-1 select-none">
                <input 
                  type="checkbox" 
                  id="isActiveEdit"
                  checked={isActiveInput}
                  onChange={e => setIsActiveInput(e.target.checked)}
                  className="size-3.5 border-border rounded focus:ring-blue-500"
                />
                <label htmlFor="isActiveEdit" className="text-muted-foreground font-medium cursor-pointer">Set as Active Focus Goal</label>
              </div>

              <div className="flex items-center gap-3 border-t border-border/30 pt-4 mt-6">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/10 transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
        </BottomSheet>
      )}
    </div>
  )
}
