import React, { useState, useMemo } from 'react'
import type { WishlistItem } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { 
  Gift, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  Clock, 
  CheckCircle2,
  TrendingUp,
  X,
  Target,
  Edit2
} from 'lucide-react'

interface WishlistViewProps {
  wishlist: WishlistItem[]
  rewardsBalance: number
  rewardsTarget: number
  currency: string
  hideSensitive: boolean
  onAddItem: (item: Partial<WishlistItem>) => Promise<void>
  onUpdateItem: (id: number, item: WishlistItem) => Promise<void>
  onDeleteItem: (id: number) => Promise<void>
  onPurchaseItem: (id: number) => Promise<void>
  formatSensitive: (val: number) => React.ReactNode
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  wishlist,
  rewardsBalance,
  rewardsTarget,
  currency,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onPurchaseItem,
  formatSensitive
}) => {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  
  // Form states
  const [nameInput, setNameInput] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [linkInput, setLinkInput] = useState('')
  const [priorityInput, setPriorityInput] = useState('Medium')
  const [isActiveInput, setIsActiveInput] = useState(false)

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
  const monthlySavingsRate = rewardsTarget > 0 ? rewardsTarget : 100 // fallback to 100/mo
  const getTimelineString = (itemPrice: number) => {
    const remaining = itemPrice - rewardsBalance
    if (remaining <= 0) return 'Available Now! 🎉'
    
    const months = remaining / monthlySavingsRate
    const days = Math.ceil(months * 30)
    
    const today = new Date()
    const targetDate = new Date(today.setDate(today.getDate() + days))
    const formattedDate = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    
    if (days < 30) {
      return `Unlock in ~${days} Days (${formattedDate})`
    }
    const roundedMonths = (days / 30).toFixed(1)
    return `Unlock in ~${roundedMonths} Months (${formattedDate})`
  }



  const handleOpenAddModal = () => {
    setNameInput('')
    setPriceInput('')
    setLinkInput('')
    setPriorityInput('Medium')
    setIsActiveInput(wishlist.filter(w => !w.isPurchased).length === 0)
    setShowAddModal(true)
  }

  const handleOpenEditModal = (item: WishlistItem) => {
    setEditingItem(item)
    setNameInput(item.name)
    setPriceInput(item.price.toString())
    setLinkInput(item.linkUrl || '')
    setPriorityInput(item.priority)
    setIsActiveInput(item.isActive)
    setShowEditModal(true)
  }

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(priceInput)
    if (!nameInput.trim() || isNaN(price) || price <= 0) return

    await onAddItem({
      name: nameInput,
      price,
      linkUrl: linkInput.trim() || undefined,
      priority: priorityInput,
      isActive: isActiveInput
    })
    setShowAddModal(false)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    const price = parseFloat(priceInput)
    if (!nameInput.trim() || isNaN(price) || price <= 0) return

    await onUpdateItem(editingItem.id, {
      ...editingItem,
      name: nameInput,
      price,
      linkUrl: linkInput.trim() || undefined,
      priority: priorityInput,
      isActive: isActiveInput
    })
    setShowEditModal(false)
    setEditingItem(null)
  }

  const handleToggleActive = async (item: WishlistItem) => {
    await onUpdateItem(item.id, {
      ...item,
      isActive: true
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Banner Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Rewards Balance</span>
            <span className="text-xl font-black text-pink-500 mt-1 block">{formatSensitive(rewardsBalance)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-500">
            <Gift className="size-5" />
          </div>
        </div>
        
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Goals Cost</span>
            <span className="text-xl font-black text-foreground mt-1 block">{formatSensitive(totalCost)}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <Target className="size-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Claimable Goals</span>
            <span className="text-xl font-black text-green-500 mt-1 block">{affordableCount} Items</span>
          </div>
          <div className="p-2.5 rounded-xl bg-green-500/10 text-green-500">
            <Sparkles className="size-5" />
          </div>
        </div>
      </div>

      {/* Hero Card & Queue Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Active Focus Item (Hero Card) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-4 text-pink-500" />
              Active Goal Focus
            </h3>
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 transition cursor-pointer"
            >
              <Plus className="size-3.5" /> Add Goal
            </button>
          </div>

          {activeItem ? (
            (() => {
              const pct = Math.min(100, (rewardsBalance / activeItem.price) * 100)
              const canAfford = rewardsBalance >= activeItem.price

              return (
                <div 
                  className={`p-6 rounded-2xl bg-card border transition-all duration-300 flex flex-col justify-between ${
                    canAfford 
                      ? 'border-green-500/50 shadow-md shadow-green-500/5 ring-1 ring-green-500/10' 
                      : 'border-border/60 shadow-xs'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                        activeItem.priority === 'High' 
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                          : activeItem.priority === 'Medium'
                          ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                          : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                      }`}>
                        {activeItem.priority} Priority
                      </span>
                      {canAfford ? (
                        <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
                          <Sparkles className="size-3.5 animate-spin" /> Ready to Claim
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3.5" /> Saving In Progress
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                        {activeItem.name}
                        {activeItem.linkUrl && (
                          <a 
                            href={activeItem.linkUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-500 hover:text-blue-600 transition"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </h2>
                      <div className="text-3xl font-black text-foreground mt-2">
                        {formatSensitive(activeItem.price)}
                      </div>
                    </div>

                    {/* Progress Bar Area */}
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs font-bold text-muted-foreground">
                        <span>Funded</span>
                        <span className={canAfford ? 'text-green-500' : 'text-pink-500'}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            canAfford 
                              ? 'bg-gradient-to-r from-green-400 to-green-500' 
                              : 'bg-gradient-to-r from-pink-500 to-purple-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                        <span>{formatSensitive(rewardsBalance)} saved</span>
                        <span>{formatSensitive(activeItem.price)} target</span>
                      </div>
                    </div>

                    {/* Predictor Ribbon */}
                    <div className="p-3 bg-muted/40 rounded-xl border border-border/30 flex items-start gap-2.5">
                      {!canAfford && <TrendingUp className="size-4 mt-0.5 shrink-0 text-pink-500" />}
                      <div className="text-xs">
                        <span className="font-bold text-foreground block">
                          {getTimelineString(activeItem.price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-6 border-t border-border/30 pt-4">
                    <button
                      onClick={() => onPurchaseItem(activeItem.id)}
                      disabled={!canAfford}
                      className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition duration-200 cursor-pointer text-center ${
                        canAfford
                          ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md shadow-green-600/10'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? 'Claim Reward' : <>Need {formatSensitive(activeItem.price - rewardsBalance)} More</>}
                    </button>
                    
                    <button
                      onClick={() => handleOpenEditModal(activeItem)}
                      className="p-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-xl border border-border/40 transition cursor-pointer"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => onDeleteItem(activeItem.id)}
                      className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="p-8 rounded-2xl bg-card border border-border/60 border-dashed text-center flex flex-col items-center justify-center min-h-[300px]">
              <Gift className="size-10 text-muted-foreground/60 mb-2 animate-bounce" />
              <h4 className="font-bold text-foreground text-sm">No Active Focus Item</h4>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">Set a goal from your wishlist queue below or create a new target to track savings progress.</p>
              <button 
                onClick={handleOpenAddModal}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/10 transition cursor-pointer"
              >
                <Plus className="size-3.5" /> Add Goal
              </button>
            </div>
          )}
        </div>

        {/* Queued & Wishlist Items List */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 px-1">
            <Clock className="size-4 text-blue-500" />
            Wishlist Queue ({queuedItems.length})
          </h3>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {queuedItems.length > 0 ? (
              queuedItems.map(item => {
                const pct = Math.min(100, (rewardsBalance / item.price) * 100)
                const canAfford = rewardsBalance >= item.price

                return (
                  <div 
                    key={item.id}
                    className={`p-4 rounded-xl bg-card border border-border/60 hover:border-blue-500/20 shadow-xs flex items-center justify-between gap-4 transition duration-200 group ${
                      canAfford ? 'border-green-500/20 bg-green-500/[0.01]' : ''
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground text-xs truncate">{item.name}</h4>
                        {canAfford && (
                          <span className="size-1.5 rounded-full bg-green-500 animate-pulse" title="Ready to claim" />
                        )}
                      </div>
                      <div className="text-sm font-extrabold text-foreground">{formatSensitive(item.price)}</div>
                      <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                        <div 
                          className={`h-full ${canAfford ? 'bg-green-500' : 'bg-pink-500'}`} 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="px-2.5 py-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500 text-xs font-bold rounded-lg border border-blue-500/10 hover:text-white transition cursor-pointer"
                      >
                        Focus
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 hover:bg-muted text-muted-foreground rounded-lg border border-transparent hover:border-border/40 transition cursor-pointer"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg border border-transparent hover:border-red-500/10 transition cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-6 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground">
                No items in the wishlist queue.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Log / Purchased Items */}
      {purchasedItems.length > 0 && (
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-4">
            <CheckCircle2 className="size-4 text-green-500" />
            Purchased Rewards History ({purchasedItems.length})
          </h3>
          <div className="divide-y divide-border/30 text-xs font-semibold">
            {purchasedItems.map(item => (
              <div key={item.id} className="py-3 flex items-center justify-between text-foreground">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-green-500/10 text-green-500">
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
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">Add New Wish Goal</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition cursor-pointer">
                <X className="size-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveAdd} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-muted-foreground block mb-1">Goal Name *</label>
                <input 
                  type="text" 
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="e.g. Mechanical Keyboard, Weekend Trip"
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground block mb-1">Price ({currency}) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={priceInput}
                    onChange={e => setPriceInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
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

              <div>
                <label className="text-muted-foreground block mb-1">Store / Link URL (Optional)</label>
                <input 
                  type="url" 
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-medium"
                />
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
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/10 transition cursor-pointer"
                >
                  Add Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-sm font-bold text-foreground">Edit Wish Goal</h3>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground transition cursor-pointer">
                <X className="size-4" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-muted-foreground block mb-1">Goal Name *</label>
                <input 
                  type="text" 
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground block mb-1">Price ({currency}) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={priceInput}
                    onChange={e => setPriceInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
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

              <div>
                <label className="text-muted-foreground block mb-1">Store / Link URL (Optional)</label>
                <input 
                  type="url" 
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-medium"
                />
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
                  onClick={() => setShowEditModal(false)}
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
          </div>
        </div>
      )}
    </div>
  )
}
