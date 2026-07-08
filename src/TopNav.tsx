import React, { useState, useEffect } from 'react'
import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { 
  TrendingUp, 
  Wallet, 
  LogOut, 
  Plus, 
  CreditCard,
  Eye,
  EyeOff,
  Bell,
  Moon,
  Sun,
  PiggyBank,
  FileText,
  Settings
} from 'lucide-react'
import { formatCurrencyVal } from './lib/utils'
import { triggerHaptic } from './lib/haptics'
import { CustomConfirmModal } from './components/ui/CustomConfirmModal'
import { SwipeableRow } from './components/ui/SwipeableRow'
import { AppLogo } from './components/ui/AppLogo'
import type { AppTab } from './types'

interface TopNavProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  totalBalance: number
  onQuickAction?: (action: 'transaction' | 'subscription' | 'wishlist') => void
  hideSensitive: boolean
  onToggleHideSensitive: () => void
  onLogout: () => void
  username: string
  pendingNotifications: any[]
  onConfirmSubscription: (noti: any, paidDate: string) => void
  onDeletePayment: (id: string) => void
  darkMode: boolean
  onToggleDarkMode: () => void
  currency?: string
  onMouseEnterWallet?: () => void
  onMouseLeaveWallet?: () => void
  isSyncing?: boolean
  syncLabel?: string
  isOffline?: boolean
  onDiscardSubscription?: (noti: any) => void
  draftCount?: number
  failedOpsCount?: number
  onOpenFailedOps?: () => void
}

const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  totalBalance,
  onQuickAction,
  hideSensitive,
  onToggleHideSensitive,
  onLogout,
  username,
  pendingNotifications,
  onConfirmSubscription,
  onDeletePayment,
  darkMode,
  onToggleDarkMode,
  currency = 'USD',
  onMouseEnterWallet,
  onMouseLeaveWallet,
  isSyncing = false,
  syncLabel,
  isOffline = false,
  onDiscardSubscription,
  draftCount = 0,
  failedOpsCount = 0,
  onOpenFailedOps
}) => {
  const [isBellOpen, setIsBellOpen] = useState(false)
  const [confirmNotiId, setConfirmNotiId] = useState<string | null>(null)
  const [paidDate, setPaidDate] = useState('')
  const [notiToDelete, setNotiToDelete] = useState<any | null>(null)

  useEffect(() => {
    if (!isBellOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.bell-container')) {
        setIsBellOpen(false)
        setConfirmNotiId(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isBellOpen])

  const allAlerts = pendingNotifications || []

  const hasAlerts = allAlerts.length > 0

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const navItems: Array<{
    tab: AppTab
    label: string
    mobileLabel: string
    Icon: React.ComponentType<{ className?: string }>
    activeClass: string
    iconClass: string
    dotClass: string
  }> = [
    {
      tab: 'dashboard',
      label: 'Dashboard',
      mobileLabel: 'Dashboard',
      Icon: TrendingUp,
      activeClass: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25 shadow-blue-500/10',
      iconClass: 'text-blue-500',
      dotClass: 'bg-blue-500'
    },
    {
      tab: 'recurring',
      label: 'Recurring',
      mobileLabel: 'Recurring',
      Icon: CreditCard,
      activeClass: 'bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/25 shadow-violet-500/10',
      iconClass: 'text-violet-500',
      dotClass: 'bg-violet-500'
    },
    {
      tab: 'ledger',
      label: 'Ledger',
      mobileLabel: 'Ledger',
      Icon: Wallet,
      activeClass: 'bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/25 shadow-teal-500/10',
      iconClass: 'text-teal-500',
      dotClass: 'bg-teal-500'
    },
    {
      tab: 'wishlist',
      label: 'Wishlist',
      mobileLabel: 'Wishlist',
      Icon: PiggyBank,
      activeClass: 'bg-pink-500/12 text-pink-600 dark:text-pink-400 border-pink-500/25 shadow-pink-500/10',
      iconClass: 'text-pink-500',
      dotClass: 'bg-pink-500'
    },
    {
      tab: 'settings',
      label: 'Settings',
      mobileLabel: 'Settings',
      Icon: Settings,
      activeClass: 'bg-slate-500/12 text-slate-600 dark:text-slate-300 border-slate-500/25 shadow-slate-500/10',
      iconClass: 'text-slate-500',
      dotClass: 'bg-slate-500'
    }
  ]

  return (
    <>
      <header
        className="glass-nav sticky top-0 z-50 w-full border-b border-border/40 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-[2.5px] w-full bg-gradient-to-r from-blue-500 via-teal-500 via-amber-500 to-pink-500" />
        <div className="container mx-auto flex h-16 items-center px-4">
        
        {/* Left Side (Logo and Brand) */}
        <div className="flex-1 flex items-center justify-start min-w-max">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => onTabChange('dashboard')}>
            <AppLogo className="size-9 rounded-xl transition-transform duration-200 hover:scale-105" />
            <span className="hidden sm:inline text-base sm:text-lg font-extrabold tracking-tight bg-linear-to-r from-foreground via-foreground to-blue-500 bg-clip-text text-transparent truncate">
              FinancialApp
            </span>
          </div>
          {isOffline ? (
            <div
              className="ml-2.5 flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] font-bold text-amber-500 select-none shrink-0"
              title="No network connection — showing cached data, changes will sync once you're back online"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              Offline
            </div>
          ) : (isSyncing || syncLabel) && (
            <div className="ml-2.5 flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] font-bold text-blue-500 animate-pulse select-none shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              {syncLabel || 'Syncing...'}
            </div>
          )}
          {failedOpsCount > 0 && (
            <div
              onClick={() => onOpenFailedOps?.()}
              className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-destructive/10 border border-destructive/20 rounded-md text-[10px] font-bold text-destructive cursor-pointer select-none shrink-0 hover:bg-destructive/20 transition duration-150"
              title="Operations that failed to sync after 5 attempts and were removed from active queue — click to view and discard"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
              <span>{failedOpsCount} failed</span>
            </div>
          )}
          {draftCount > 0 && (
            <div 
              onClick={() => onTabChange('drafts')}
              className="ml-2.5 flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] font-bold text-amber-500 cursor-pointer select-none shrink-0 hover:bg-amber-500/25 transition duration-150 animate-in fade-in zoom-in-95"
              title="Draft transactions waiting to be synced to the server"
            >
              <FileText className="size-3" />
              <span>{draftCount} Draft{draftCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs - Centered mathematically on desktop, flex-safe on medium screens */}
        <div className="hidden md:flex items-center justify-center shrink-0 mx-4">
          <nav className="flex items-center gap-1 bg-card/72 p-1.5 rounded-xl border border-border/50 shadow-sm select-none">
            {navItems.map(({ tab, label, Icon, activeClass, iconClass, dotClass }) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? `${activeClass} font-bold shadow-sm scale-[1.02]`
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/45'
                  }`}
                >
                  <Icon className={`size-3.5 ${isActive ? iconClass : 'text-muted-foreground'}`} />
                  <span>{label}</span>
                  {isActive && <span className={`absolute -bottom-1 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full ${dotClass}`} />}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right Side Widgets & Actions */}
        <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-3 md:gap-4 min-w-max">
          
          {/* Quick Metrics (Balance Display) */}
          <div 
            onMouseEnter={onMouseEnterWallet}
            onMouseLeave={onMouseLeaveWallet}
            onClick={() => onTabChange('dashboard')}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-xl select-none shrink-0 cursor-pointer transition-all duration-150" 
            title={hideSensitive ? "Sensitive balance hidden (Click to view dashboard)" : "Net Balance (Hover to highlight categories)"}
          >
            <Wallet className="size-3.5 text-blue-500" />
            {hideSensitive ? (
              <span 
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleHideSensitive()
                }}
                title="Tap to toggle privacy mode"
                className="animate-pulse bg-blue-500/20 hover:bg-blue-500/30 text-transparent blur-[3px] hover:blur-0 rounded px-1.5 py-0.5 text-xs font-mono select-none cursor-pointer transition-all duration-300"
              >
                {formatCurrency(totalBalance)}
              </span>
            ) : (
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 transition-all duration-300">
                {formatCurrency(totalBalance)}
              </span>
            )}
          </div>

          {/* Notification Bell Dropdown */}
          <div className="relative bell-container">
            <button
              onClick={() => setIsBellOpen(prev => !prev)}
              className="p-1.5 bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 hover:border-amber-500/20 text-amber-500/80 hover:text-amber-500 rounded-xl cursor-pointer transition duration-150 flex items-center justify-center relative"
              title="Subscription Notifications"
            >
              <Bell className="size-4 text-amber-500" />
              {hasAlerts && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-background animate-pulse" />
              )}
            </button>

            {isBellOpen && (
              <div className="fixed sm:absolute top-[calc(4rem+env(safe-area-inset-top,0px))] sm:top-auto left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:w-80 bg-card border border-border rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3 select-none">
                  <h4 className="text-xs font-bold text-foreground">Subscription Notifications</h4>
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    {allAlerts.length} pending
                  </span>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {allAlerts.map(noti => {
                    const isConfirming = confirmNotiId === noti.id
                    const notificationBody = (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground truncate block">{noti.name}</span>
                          <span className="text-[9px] text-muted-foreground block whitespace-nowrap">{noti.billingDate}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-orange-500 font-extrabold block transition-all duration-300 ${hideSensitive ? 'blur-sm select-none pointer-events-none' : ''}`}>
                            -{formatCurrency(noti.amount)}
                          </span>
                        </div>
                      </div>
                    )
                    const startConfirm = () => {
                      if (hideSensitive) return
                      setConfirmNotiId(noti.id)
                      setPaidDate(noti.billingDate)
                    }
                    const discardNotification = () => {
                      if (hideSensitive) return
                      onDiscardSubscription?.(noti)
                      setIsBellOpen(false)
                    }
                    const requestDelete = () => {
                      if (hideSensitive) return
                      setNotiToDelete(noti)
                    }
                    const notificationActions = (
                      <>
                        <button
                          onClick={startConfirm}
                          disabled={hideSensitive}
                          className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[10px] font-extrabold transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Pay
                        </button>
                        {onDiscardSubscription && (
                          <button
                            onClick={discardNotification}
                            disabled={hideSensitive}
                            className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-[10px] font-extrabold transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                          >
                            Skip
                          </button>
                        )}
                        <button
                          onClick={requestDelete}
                          disabled={hideSensitive}
                          className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[10px] font-extrabold transition cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Remove
                        </button>
                      </>
                    )
                    const notificationDesktopActions = (
                      <>
                        <button
                          onClick={startConfirm}
                          disabled={hideSensitive}
                          title={hideSensitive ? 'Unhide balances to edit' : undefined}
                          className="px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-bold text-[9px] rounded transition cursor-pointer text-center whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Pay
                        </button>
                        {onDiscardSubscription && (
                          <button
                            onClick={discardNotification}
                            disabled={hideSensitive}
                            title={hideSensitive ? 'Unhide balances to edit' : "Discard this cycle's payment"}
                            className="px-2 py-1 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-[9px] rounded transition cursor-pointer text-center whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Skip
                          </button>
                        )}
                        <button
                          onClick={requestDelete}
                          disabled={hideSensitive}
                          title={hideSensitive ? 'Unhide balances to edit' : 'Delete subscription definition entirely'}
                          className="px-2 py-1 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-[9px] rounded border border-orange-500/10 transition cursor-pointer text-center whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Remove
                        </button>
                      </>
                    )
                    return (
                      <div key={noti.id}>
                        {isConfirming ? (
                          <div className="flex flex-col gap-1.5 p-1.5 bg-background border border-border rounded-lg mt-1 animate-in slide-in-from-bottom-1 duration-150">
                            {notificationBody}
                            <label className="text-[8px] font-bold text-muted-foreground">Paid Date:</label>
                            <div className="flex flex-col sm:flex-row gap-1.5">
                              <input
                                type="date"
                                value={paidDate}
                                onChange={e => setPaidDate(e.target.value)}
                                className="w-full sm:flex-1 px-1.5 py-0.5 text-[10px] bg-background border border-border rounded focus:outline-none"
                              />
                              <div className="flex gap-1.5 w-full sm:w-auto">
                                <button
                                  onClick={() => {
                                    onConfirmSubscription(noti, paidDate)
                                    setConfirmNotiId(null)
                                  }}
                                  className="flex-1 sm:flex-initial px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold cursor-pointer hover:bg-blue-700 text-center"
                                >
                                  Pay
                                </button>
                                <button
                                  onClick={() => setConfirmNotiId(null)}
                                  className="px-1.5 py-0.5 bg-muted text-foreground border border-border rounded text-[10px] font-semibold cursor-pointer text-center"
                                >
                                  X
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <SwipeableRow
                            className="rounded-xl bg-muted/30 text-xs"
                            contentClassName="p-2.5"
                            actionsWidth={168}
                            actions={notificationActions}
                            desktopActions={notificationDesktopActions}
                          >
                            {notificationBody}
                          </SwipeableRow>
                        )}
                      </div>
                    )
                  })}

                  {allAlerts.length === 0 && (
                    <div className="text-[10px] text-muted-foreground py-6 text-center select-none">
                      No pending subscription notifications.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Menubar (Shadcn UI) */}
          <div className="hidden sm:block border border-border/60 rounded-xl bg-background shrink-0">
            <Menubar className="border-0 h-9 px-1 bg-transparent">
              
              {/* Add menu */}
              <MenubarMenu>
                <MenubarTrigger className="px-2 py-1 sm:px-2.5 text-xs font-semibold hover:bg-muted/50 rounded-lg cursor-pointer flex items-center gap-1 whitespace-nowrap">
                  <Plus className="size-3.5 text-blue-500" />
                  <span className="hidden xl:inline">Quick Add</span>
                </MenubarTrigger>
                <MenubarContent className="z-50 min-w-[160px] bg-card border border-border p-1 rounded-xl shadow-md">
                  <MenubarGroup>
                    <MenubarItem 
                      onClick={() => onQuickAction?.('transaction')}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer"
                    >
                      Post Transaction <Plus className="size-3 text-blue-500" />
                    </MenubarItem>
                    <MenubarItem 
                      onClick={() => onQuickAction?.('subscription')}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer"
                    >
                      New Subscription <Plus className="size-3 text-violet-500" />
                    </MenubarItem>
                    <MenubarItem 
                      onClick={() => onQuickAction?.('wishlist')}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer"
                    >
                      Add Wish Goal <Plus className="size-3 text-pink-500" />
                    </MenubarItem>
                  </MenubarGroup>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>

          {/* Profile/Account menu */}
          <div className="border border-border/60 rounded-xl bg-background shrink-0">
            <Menubar className="border-0 h-9 px-1 bg-transparent">
              <MenubarMenu>
                <MenubarTrigger className="p-1 rounded-full cursor-pointer hover:bg-muted/50">
                  <div className="size-7 rounded-full bg-linear-to-tr from-blue-500 to-sky-400 text-white font-extrabold flex items-center justify-center text-xs border border-blue-500/20">
                    {getInitials(username)}
                  </div>
                </MenubarTrigger>
                <MenubarContent className="z-50 min-w-[180px] bg-card border border-border p-1 rounded-xl shadow-md align-end">
                  <div className="px-2.5 py-2">
                    <p className="text-xs font-bold text-foreground">{username || 'User'}</p>
                    <p className="text-[10px] text-muted-foreground">Premium Account</p>
                  </div>

                  <MenubarSeparator className="my-1 border-t border-border/30" />
                  
                  <MenubarItem
                    onClick={() => onTabChange('settings')}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground"
                  >
                    <Settings className="size-3.5 text-blue-500" />
                    <span>Settings</span>
                  </MenubarItem>

                  <MenubarItem 
                    onClick={onToggleHideSensitive}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground"
                  >
                    {hideSensitive ? <Eye className="size-3.5 text-blue-500" /> : <EyeOff className="size-3.5 text-blue-500" />}
                    <span>{hideSensitive ? 'Show Sensitive' : 'Hide Sensitive'}</span>
                  </MenubarItem>

                  <MenubarItem 
                    onClick={onToggleDarkMode}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground"
                  >
                    {darkMode ? <Sun className="size-3.5 text-blue-500" /> : <Moon className="size-3.5 text-blue-500" />}
                    <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
                  </MenubarItem>



                  <MenubarSeparator className="my-1 border-t border-border/30" />
                  
                  <MenubarItem 
                    onClick={onLogout}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-orange-500 hover:bg-orange-500/10 outline-hidden cursor-pointer"
                  >
                    <LogOut className="size-3.5" /> Logout
                  </MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </div>
          
        </div>
      </div>
    </header>

    {/* Mobile Navigation bar (Sticky Bottom Nav) */}
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/88 backdrop-blur-xl select-none shadow-[0_-12px_30px_rgba(0,0,0,0.08)] transform-gpu"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', paddingTop: '10px', willChange: 'transform' }}
    >
      <nav aria-label="Primary" className="grid grid-cols-5 w-full max-w-md mx-auto justify-items-center">
        {navItems.map(({ tab, mobileLabel, Icon, activeClass, iconClass, dotClass }) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => { triggerHaptic(8); onTabChange(tab) }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-w-0 flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer transition-all duration-200 w-full text-center ${
                isActive ? 'scale-105 font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`relative flex size-8 items-center justify-center rounded-xl border transition-all duration-200 ${
                isActive ? `${activeClass} shadow-sm` : 'border-transparent bg-transparent'
              }`}>
                <Icon className={`size-4.5 mx-auto ${isActive ? iconClass : 'text-muted-foreground'}`} />
                {isActive && <span className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${dotClass}`} />}
              </span>
              <span className="truncate max-w-full px-0.5">{mobileLabel}</span>
            </button>
          )
        })}
      </nav>
    </div>
    <CustomConfirmModal
      isOpen={!!notiToDelete}
      title="Remove Subscription"
      message="Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription."
      confirmText="Remove"
      cancelText="Cancel"
      onConfirm={() => {
        if (notiToDelete) {
          onDeletePayment(notiToDelete.recurringPaymentId)
          setNotiToDelete(null)
        }
      }}
      onCancel={() => setNotiToDelete(null)}
    />
    </>
  )
}

export default TopNav
