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
  RefreshCw,
  CreditCard,
  Eye,
  EyeOff,
  Bell
} from 'lucide-react'

interface TopNavProps {
  activeTab: 'dashboard' | 'recurring' | 'ledger'
  onTabChange: (tab: 'dashboard' | 'recurring' | 'ledger') => void
  totalBalance: number
  onPostQuickTransaction: () => void
  hideSensitive: boolean
  onToggleHideSensitive: () => void
  onLogout: () => void
  username: string
  pendingNotifications: any[]
  onConfirmSubscription: (noti: any, paidDate: string) => void
  onDeletePayment: (id: string) => void
}

const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  totalBalance,
  onPostQuickTransaction,
  hideSensitive,
  onToggleHideSensitive,
  onLogout,
  username,
  pendingNotifications,
  onConfirmSubscription,
  onDeletePayment
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        
        {/* Brand Logo and Title */}
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => onTabChange('dashboard')}>
          <div className="flex size-9 items-center justify-center rounded-xl bg-radial from-blue-400 to-blue-600 shadow-md shadow-blue-500/20 text-white font-extrabold text-lg">
            F
          </div>
          <span className="text-lg font-extrabold tracking-tight bg-linear-to-r from-foreground via-foreground to-blue-500 bg-clip-text text-transparent">
            FinancialApp
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/40 p-1.5 rounded-xl border border-border/40 select-none">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-card text-foreground shadow-xs border border-border/10 font-bold scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onTabChange('recurring')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === 'recurring'
                ? 'bg-card text-foreground shadow-xs border border-border/10 font-bold scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            Recurring Payments
          </button>
          <button
            onClick={() => onTabChange('ledger')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-card text-foreground shadow-xs border border-border/10 font-bold scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            Ledger
          </button>
        </nav>

        {/* Right Side Widgets & Actions */}
        <div className="flex items-center gap-4">
          
          {/* Quick Metrics (Balance Display) */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 border border-blue-500/10 rounded-xl select-none">
            <Wallet className="size-3.5 text-blue-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Net Balance:</span>
            <span className={`text-xs font-bold text-foreground transition-all duration-300 ${hideSensitive ? 'blur-sm select-none pointer-events-none' : ''}`}>
              {formatCurrency(totalBalance)}
            </span>
          </div>

          {/* Sensitive Hide/Show Toggle */}
          <button
            onClick={onToggleHideSensitive}
            className="p-1.5 border border-border/60 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition duration-150 flex items-center justify-center"
            title={hideSensitive ? "Show sensitive figures" : "Hide sensitive figures"}
          >
            {hideSensitive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>

          {/* Notification Bell Dropdown */}
          <div className="relative bell-container">
            <button
              onClick={() => setIsBellOpen(prev => !prev)}
              className="p-1.5 border border-border/60 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition duration-150 flex items-center justify-center relative"
              title="Subscription Notifications"
            >
              <Bell className="size-4" />
              {hasAlerts && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-yellow-500 ring-2 ring-background animate-pulse" />
              )}
            </button>

            {isBellOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
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
                            <div className="flex gap-1.5">
                              <input
                                type="date"
                                value={paidDate}
                                onChange={e => setPaidDate(e.target.value)}
                                className="flex-1 px-1.5 py-0.5 text-[10px] bg-background border border-border rounded focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  onConfirmSubscription(noti, paidDate)
                                  setConfirmNotiId(null)
                                }}
                                className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold cursor-pointer hover:bg-blue-700"
                              >
                                Pay
                              </button>
                              <button
                                onClick={() => setConfirmNotiId(null)}
                                className="px-1.5 py-0.5 bg-muted text-foreground border border-border rounded text-[10px] font-semibold cursor-pointer"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 border-t border-border/10 pt-1.5 mt-0.5">
                            <button
                              onClick={() => {
                                setConfirmNotiId(noti.id)
                                setPaidDate(noti.billingDate)
                              }}
                              className="px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-bold text-[9px] rounded transition cursor-pointer"
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
                              className="px-2 py-1 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-[9px] rounded border border-orange-500/10 transition cursor-pointer"
                              title="Delete subscription definition entirely"
                            >
                              Remove Subscription
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
          <div className="border border-border/60 rounded-xl overflow-hidden bg-background">
            <Menubar className="border-0 h-9 px-1 bg-transparent">
              
              {/* Add menu */}
              <MenubarMenu>
                <MenubarTrigger className="px-2.5 py-1 text-xs font-semibold hover:bg-muted/50 rounded-lg cursor-pointer flex items-center gap-1">
                  <Plus className="size-3.5 text-blue-500" /> Quick Add
                </MenubarTrigger>
                <MenubarContent className="z-50 min-w-[160px] bg-card border border-border p-1 rounded-xl shadow-md">
                  <MenubarGroup>
                    <MenubarItem 
                      onClick={onPostQuickTransaction}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer"
                    >
                      Post Transaction <Plus className="size-3" />
                    </MenubarItem>
                    <MenubarItem 
                      onClick={() => onTabChange('recurring')}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer"
                    >
                      New Subscription <Plus className="size-3" />
                    </MenubarItem>
                  </MenubarGroup>
                  <MenubarSeparator className="my-1 border-t border-border/30" />
                  <MenubarItem className="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-not-allowed text-muted-foreground opacity-60">
                    Sync Bank <RefreshCw className="size-3" />
                  </MenubarItem>
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
      
      {/* Mobile Navigation bar */}
      <div className="flex md:hidden items-center justify-around border-t border-border/40 bg-background/90 py-2.5 px-4 select-none">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer ${
            activeTab === 'dashboard' ? 'text-blue-500' : 'text-muted-foreground'
          }`}
        >
          <TrendingUp className="size-4" />
          Dashboard
        </button>
        <button
          onClick={() => onTabChange('recurring')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer ${
            activeTab === 'recurring' ? 'text-blue-500' : 'text-muted-foreground'
          }`}
        >
          <CreditCard className="size-4" />
          Recurring
        </button>
        <button
          onClick={() => onTabChange('ledger')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold cursor-pointer ${
            activeTab === 'ledger' ? 'text-blue-500' : 'text-muted-foreground'
          }`}
        >
          <Wallet className="size-4" />
          Ledger
        </button>
      </div>
    </header>
  )
}

export default TopNav