import React from 'react'
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
  CalendarCheck2,
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
  Settings,
  Sparkles,
  BarChart3,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { triggerHaptic } from './lib/haptics'
import { AppLogo } from './components/ui/AppLogo'
import type { AppTab, PendingNotification } from './types'
import type { SensitivePreferenceStatus } from './app/useAppPreferences'

interface TopNavProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  onQuickAction?: (action: 'transaction' | 'subscription' | 'wishlist') => void
  onAskAI?: () => void
  hideSensitive: boolean
  sensitivePreferenceStatus: SensitivePreferenceStatus
  onToggleHideSensitive: () => void
  onRetrySensitivePreference: () => void
  onLogout: () => void
  username: string
  pendingNotifications: PendingNotification[]
  onOpenNotifications: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  isSyncing?: boolean
  syncLabel?: string
  isOffline?: boolean
  draftCount?: number
  failedOpsCount?: number
  onOpenFailedOps?: () => void
}

const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  onQuickAction,
  onAskAI,
  hideSensitive,
  sensitivePreferenceStatus,
  onToggleHideSensitive,
  onRetrySensitivePreference,
  onLogout,
  username,
  pendingNotifications,
  onOpenNotifications,
  darkMode,
  onToggleDarkMode,
  isSyncing = false,
  syncLabel,
  isOffline = false,
  draftCount = 0,
  failedOpsCount = 0,
  onOpenFailedOps
}) => {
  const hasAlerts = pendingNotifications.length > 0

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
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
      label: 'Today',
      mobileLabel: 'Today',
      Icon: CalendarCheck2,
      activeClass: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25 shadow-blue-500/10',
      iconClass: 'text-blue-500',
      dotClass: 'bg-blue-500'
    },
    {
      tab: 'reports',
      label: 'Reports',
      mobileLabel: 'Reports',
      Icon: BarChart3,
      activeClass: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 shadow-indigo-500/10',
      iconClass: 'text-indigo-500',
      dotClass: 'bg-indigo-500'
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
      tab: 'recurring',
      label: 'Recurring',
      mobileLabel: 'Recurring',
      Icon: CreditCard,
      activeClass: 'bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/25 shadow-violet-500/10',
      iconClass: 'text-violet-500',
      dotClass: 'bg-violet-500'
    },
    {
      tab: 'wishlist',
      label: 'Wishlist',
      mobileLabel: 'Wishlist',
      Icon: PiggyBank,
      activeClass: 'bg-pink-500/12 text-pink-600 dark:text-pink-400 border-pink-500/25 shadow-pink-500/10',
      iconClass: 'text-pink-500',
      dotClass: 'bg-pink-500'
    }
  ]

  return (
    <>
      <header
        className="glass-nav sticky top-0 z-50 w-full border-b border-border/40 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-[2.5px] w-full bg-gradient-to-r from-blue-500 via-teal-500 via-amber-500 to-pink-500" />
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center px-4 sm:px-6 lg:px-8">
        
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
              title="Operations that failed to sync and were removed from the active queue — click to view details"
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
          
          <button
            type="button"
            onClick={onAskAI}
            className="hidden md:flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/8 hover:bg-blue-500/14 border border-blue-500/20 hover:border-blue-500/35 text-blue-600 dark:text-blue-400 rounded-xl select-none shrink-0 transition-all duration-150 cursor-pointer"
            title="ASK AI"
            aria-label="ASK AI"
          >
            <Sparkles className="size-3.5" />
            <span className="text-xs font-extrabold tracking-wide">ASK AI</span>
          </button>

          {/* One notification entry point; the shared review sheet is owned by App. */}
          <div className="relative">
            <button
              type="button"
              onClick={onOpenNotifications}
              className="p-1.5 bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 hover:border-amber-500/20 text-amber-500/80 hover:text-amber-500 rounded-xl cursor-pointer transition duration-150 flex items-center justify-center relative"
              title={hasAlerts ? `${pendingNotifications.length} bills need review` : 'No bills need review'}
              aria-label={hasAlerts ? `Review ${pendingNotifications.length} pending bills` : 'Bills: all caught up'}
            >
              <Bell className="size-4 text-amber-500" />
              {hasAlerts && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-background animate-pulse" />
              )}
            </button>
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
                    onClick={sensitivePreferenceStatus === 'resolved' ? onToggleHideSensitive : undefined}
                    disabled={sensitivePreferenceStatus !== 'resolved'}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground disabled:cursor-not-allowed"
                  >
                    {sensitivePreferenceStatus === 'pending'
                      ? <Loader2 className="size-3.5 animate-spin text-blue-500" />
                      : hideSensitive
                        ? <Eye className="size-3.5 text-blue-500" />
                        : <EyeOff className="size-3.5 text-blue-500" />}
                    <span>
                      {sensitivePreferenceStatus === 'pending'
                        ? 'Checking Privacy Settings'
                        : sensitivePreferenceStatus === 'unavailable'
                          ? 'Privacy Setting Unavailable'
                          : hideSensitive ? 'Show Sensitive' : 'Hide Sensitive'}
                    </span>
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
        {sensitivePreferenceStatus !== 'resolved' && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="privacy-status"
            className={`pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-50 w-max max-w-[calc(100vw_-_1.5rem)] -translate-x-1/2 rounded-2xl border px-3 py-2 text-center text-[11px] font-semibold shadow-lg backdrop-blur-xl transition-[opacity,transform] duration-200 ${
              sensitivePreferenceStatus === 'pending'
                ? 'border-blue-500/25 bg-card/94 text-blue-700 shadow-blue-500/10 dark:border-blue-500/35 dark:text-blue-300'
                : 'border-amber-500/30 bg-card/96 text-amber-700 shadow-amber-500/10 dark:border-amber-500/40 dark:text-amber-300'
            }`}
          >
            <span className="pointer-events-auto flex items-center justify-center gap-2">
              {sensitivePreferenceStatus === 'pending' ? (
                <>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  </span>
                  <span className="text-left leading-snug">
                    <strong className="block font-extrabold text-foreground">Protecting your amounts</strong>
                    Checking privacy settings before anything is revealed.
                  </span>
                </>
              ) : (
                <>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                    <ShieldAlert className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-left leading-snug">
                    <strong className="block font-extrabold text-foreground">Amounts remain protected</strong>
                    Privacy settings couldn't be verified.
                  </span>
                  <button
                    type="button"
                    onClick={onRetrySensitivePreference}
                    className="ml-1 shrink-0 rounded-lg border border-current/20 px-2 py-1 font-extrabold hover:bg-amber-500/10 cursor-pointer"
                  >
                    Retry
                  </button>
                </>
              )}
            </span>
          </div>
        )}
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
    </>
  )
}

export default TopNav
