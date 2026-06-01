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
  PiggyBank
} from 'lucide-react'
import { formatCurrencyVal } from './lib/utils'

interface TopNavProps {
  activeTab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist'
  onTabChange: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist') => void
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
  onMouseLeaveWallet
}) => {
  const [isBellOpen, setIsBellOpen] = useState(false)
  const [confirmNotiId, setConfirmNotiId] = useState<string | null>(null)
  const [paidDate, setPaidDate] = useState('')

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

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="h-[2.5px] w-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500" />
        <div className="container mx-auto flex h-16 items-center px-4">
        
        {/* Left Side (Logo and Brand) */}
        <div className="flex-1 flex items-center justify-start min-w-max">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => onTabChange('dashboard')}>
            <div className="flex size-9 items-center justify-center rounded-xl bg-radial from-blue-400 to-blue-600 shadow-md shadow-blue-500/20 text-white font-extrabold text-lg shrink-0">
              F
            </div>
            <span className="hidden sm:inline text-md sm:text-lg font-extrabold tracking-tight bg-linear-to-r from-foreground via-foreground to-blue-500 bg-clip-text text-transparent truncate">
              FinancialApp
            </span>
          </div>
        </div>

        {/* Navigation Tabs - Centered mathematically on desktop, flex-safe on medium screens */}
        <div className="hidden md:flex items-center justify-center shrink-0 mx-4">
          <nav className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-xl border border-border/40 select-none">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onTabChange('recurring')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'recurring'
                  ? 'bg-violet-500/10 text-violet-500 border border-violet-500/20 font-bold scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              Recurring Payments
            </button>
            <button
              onClick={() => onTabChange('ledger')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              Ledger
            </button>
          </nav>
        </div>

        {/* Right Side Widgets & Actions */}
        <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-3 md:gap-4 min-w-max">
          
          {/* Quick Metrics (Balance Display) */}
          <div 
            onMouseEnter={onMouseEnterWallet}
            onMouseLeave={onMouseLeaveWallet}
            onClick={() => onTabChange('dashboard')}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-xl select-none shrink-0 cursor-pointer transition-colors duration-150" 
            title="Net Balance (Hover to highlight categories)"
          >
            <Wallet className="size-3.5 text-blue-500" />
            <span className={`text-xs font-extrabold text-blue-600 dark:text-blue-400 transition-all duration-300 ${hideSensitive ? 'blur-sm select-none pointer-events-none' : ''}`}>
              {formatCurrency(totalBalance)}
            </span>
          </div>

          {/* Quick Wish List Shortcut */}
          <button
            onClick={() => onTabChange('wishlist')}
            className={`hidden md:flex p-1.5 border rounded-xl cursor-pointer transition duration-150 items-center justify-center ${
              activeTab === 'wishlist'
                ? 'bg-pink-500/15 border-pink-500/30 text-pink-500 shadow-xs scale-[1.02] font-bold'
                : 'bg-pink-500/5 border-pink-500/10 text-pink-500/80 hover:bg-pink-500/10 hover:border-pink-500/20 hover:text-pink-500'
            }`}
            title="Wish List"
          >
            <PiggyBank className="size-4" />
          </button>

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
              <div className="absolute right-[-30px] sm:right-0 mt-2 w-[calc(100vw-32px)] sm:w-80 bg-card border border-border rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3 select-none">
                  <h4 className="text-xs font-bold text-foreground">Subscription Notifications</h4>
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    {allAlerts.length} pending
                  </span>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {allAlerts.map(noti => {
                    const isConfirming = confirmNotiId === noti.id
                    return (
                      <div key={noti.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/30 text-xs flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="truncate">
                            <span className="font-semibold text-foreground truncate block max-w-[140px]">{noti.name}</span>
                            <span className="text-[9px] text-muted-foreground block">{noti.billingDate}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-orange-500 font-extrabold block transition-all duration-300 ${hideSensitive ? 'blur-sm select-none pointer-events-none' : ''}`}>
                              -{formatCurrency(noti.amount)}
                            </span>
                          </div>
                        </div>

                        {isConfirming ? (
                          <div className="flex flex-col gap-1.5 p-1.5 bg-background border border-border rounded-lg mt-1 animate-in slide-in-from-bottom-1 duration-150">
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
                          <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/10 pt-1.5 mt-0.5">
                            <button
                              onClick={() => {
                                setConfirmNotiId(noti.id)
                                setPaidDate(noti.billingDate)
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-bold text-[9px] rounded transition cursor-pointer text-center whitespace-nowrap"
                            >
                              Confirm Paid
                            </button>
                            <button
                              onClick={() => {
                                const confirmResult = window.confirm("Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription.");
                                if (confirmResult) {
                                  onDeletePayment(noti.recurringPaymentId);
                                }
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-[9px] rounded border border-orange-500/10 transition cursor-pointer text-center whitespace-nowrap"
                              title="Delete subscription definition entirely"
                            >
                              Remove
                            </button>
                          </div>
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
          <div className="border border-border/60 rounded-xl bg-background shrink-0">
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

              {/* Profile/Account menu */}
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
                  
                  {/* Settings toggles in dropdown */}
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-md select-none shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', paddingTop: '10px' }}
    >
      <div className="grid grid-cols-4 w-full max-w-md mx-auto justify-items-center">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer transition-all duration-200 w-full text-center ${
            activeTab === 'dashboard' ? 'text-blue-500 scale-105 font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="size-4.5 mx-auto" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => onTabChange('recurring')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer transition-all duration-200 w-full text-center ${
            activeTab === 'recurring' ? 'text-violet-500 scale-105 font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CreditCard className="size-4.5 mx-auto" />
          <span>Recurring</span>
        </button>
        <button
          onClick={() => onTabChange('ledger')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer transition-all duration-200 w-full text-center ${
            activeTab === 'ledger' ? 'text-emerald-500 scale-105 font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wallet className="size-4.5 mx-auto" />
          <span>Ledger</span>
        </button>
        <button
          onClick={() => onTabChange('wishlist')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer transition-all duration-200 w-full text-center ${
            activeTab === 'wishlist' ? 'text-pink-500 scale-105 font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PiggyBank className="size-4.5 mx-auto" />
          <span>Wishlist</span>
        </button>
      </div>
    </div>
    </>
  )
}

export default TopNav