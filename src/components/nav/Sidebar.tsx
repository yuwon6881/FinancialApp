import React from 'react'
import { m } from 'framer-motion'
import { Bell, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { AppLogo } from '../ui/AppLogo'
import { SPRING } from '../../lib/animations'
import { cn } from '../../lib/utils'
import type { AppTab } from '../../types'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { DESTINATIONS, destinationForTab, type Destination } from './navModel'
import { UserProfileDropdown } from './UserProfileDropdown'

export interface SidebarProps {
  activeTab: AppTab
  onSelectDestination: (destination: Destination) => void
  onTabChange: (tab: AppTab) => void
  onNewTransaction: () => void
  newTransactionDisabled?: boolean
  onOpenSearch: () => void
  onAskAI: () => void
  onOpenNotifications: () => void
  pendingNotificationCount: number
  draftCount: number
  failedOpsCount: number
  onOpenFailedOps: () => void
  syncStatus: { busy: boolean; offline: boolean; label?: string }
  /** Configured cycle start day; the cycle card is omitted until settings load. */
  cycleDay?: number
  username: string
  hideSensitive: boolean
  sensitivePreferenceStatus: SensitivePreferenceStatus
  onToggleHideSensitive: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
}

// The cycle card is decoration beside the navigation, so it loads after the shell rather than with it.
const CycleCard = React.lazy(() => import('./SidebarCycleCard').then(module => ({ default: module.SidebarCycleCard })))

const COLLAPSED_KEY = 'lumen:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The desktop and tablet sidebar. From 1024px it is a labelled 240px column that can fold to a 72px
 * rail (remembered per device); between 640 and 1023px it is always the rail. Phones use the tab
 * bar instead. The content column reads the width from `--app-sidebar-w`, which follows the
 * `data-sidebar` attribute this component keeps on the document element.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectDestination,
  onTabChange,
  onNewTransaction,
  newTransactionDisabled = false,
  onOpenSearch,
  onAskAI,
  onOpenNotifications,
  pendingNotificationCount,
  draftCount,
  failedOpsCount,
  onOpenFailedOps,
  syncStatus,
  cycleDay,
  username,
  hideSensitive,
  sensitivePreferenceStatus,
  onToggleHideSensitive,
  darkMode,
  onToggleDarkMode,
  onLogout,
}) => {
  const [collapsed, setCollapsed] = React.useState(readCollapsed)
  const activeDestination = destinationForTab(activeTab)

  React.useEffect(() => {
    const root = document.documentElement
    if (collapsed) root.dataset.sidebar = 'collapsed'
    else delete root.dataset.sidebar
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Remembering the fold is a convenience; without storage it simply resets next visit.
    }
  }, [collapsed])

  // `wide` is the labelled layout. CSS hides labels on the rail tier, and the fold hides them on
  // desktop, so every label carries both conditions.
  const label = collapsed ? 'hidden' : 'hidden lg:inline'
  const wideOnly = collapsed ? 'hidden' : 'hidden lg:flex'

  const navItem = (
    key: string,
    text: string,
    icon: React.ReactNode,
    onClick: () => void,
    options: { active?: boolean; badge?: number; badgeTone?: 'brand' | 'warning' } = {},
  ) => (
    <Button
      key={key}
      variant="tertiary"
      type="button"
      title={text}
      aria-label={options.badge ? `${text}, ${options.badge}` : text}
      aria-current={options.active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        // No press scale on a full-width row: 3% of 200px pulls its corners out from under the
        // pointer between press and release, and the click is lost.
        'group relative isolate min-h-11 w-full gap-3 rounded-xl px-0 text-body hover:bg-transparent active:scale-100 lg:min-h-10',
        collapsed ? 'justify-center' : 'justify-center lg:justify-start lg:px-3',
        options.active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
      )}
    >
      {options.active && (
        <m.span
          layoutId="sidebar-active"
          transition={SPRING.snappy}
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-xl bg-surface-2 dark:bg-surface-3"
        />
      )}
      <span className="pointer-events-none absolute inset-0 -z-20 rounded-xl transition-colors duration-150 group-hover:bg-surface-2/70" aria-hidden="true" />
      <span className={cn('relative grid size-5 shrink-0 place-items-center', options.active && 'text-accent-ink')}>
        {icon}
        {options.badge ? (
          <span
            aria-hidden="true"
            className={cn(
              'absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full px-1 text-micro text-primary-foreground ring-2 ring-sidebar',
              options.badgeTone === 'warning' ? 'bg-amber-500 text-on-vivid' : 'bg-primary',
              !collapsed && 'lg:hidden',
            )}
          >
            {options.badge > 9 ? '9+' : options.badge}
          </span>
        ) : null}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-left', label)}>{text}</span>
      {options.badge ? (
        <span aria-hidden="true" className={cn('min-w-5 rounded-full px-1.5 text-center text-caption font-semibold', options.badgeTone === 'warning' ? 'bg-amber-500/14 text-amber-700 dark:text-amber-300' : 'bg-primary/14 text-accent-ink', label)}>
          {options.badge}
        </span>
      ) : null}
    </Button>
  )

  return (
    <aside
      aria-label="Sidebar"
      className="app-chrome fixed inset-y-0 left-0 z-40 hidden w-(--app-sidebar-w) flex-col border-r border-sidebar-border bg-sidebar pt-[env(safe-area-inset-top,0px)] transition-[width] duration-200 ease-fluid sm:flex"
    >
      <div className={cn('flex h-16 shrink-0 items-center gap-2 px-3', collapsed ? 'justify-center' : 'justify-center lg:justify-between lg:pl-4')}>
        <Button
          variant="tertiary"
          type="button"
          aria-label="Go to Today"
          onClick={() => onTabChange('dashboard')}
          className="brand-home-button min-h-11 gap-2.5 rounded-xl px-1.5 hover:bg-transparent"
        >
          <span className="relative">
            <AppLogo className="size-8 rounded-[0.625rem]" />
            {(syncStatus.offline || syncStatus.busy) && (
              <span
                role="status"
                aria-label={syncStatus.offline ? 'Offline' : syncStatus.label ?? 'Syncing'}
                title={syncStatus.offline ? 'No network connection — showing saved data; changes will sync when you are back online' : syncStatus.label}
                className={cn('absolute -right-1 -top-1 size-3 rounded-full border-2 border-sidebar', syncStatus.offline ? 'bg-amber-500' : 'animate-pulse bg-primary')}
              />
            )}
          </span>
          <span className={cn('brand-home-label text-section text-foreground', label)}>FinancialApp</span>
        </Button>
        <Button
          variant="tertiary"
          size="icon"
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(value => !value)}
          className={cn('text-muted-foreground', wideOnly)}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <div className="space-y-2 px-3">
        <Button
          variant="secondary"
          type="button"
          onClick={onOpenSearch}
          aria-label="Search your records"
          title="Search (Ctrl+K)"
          className={cn('min-h-11 w-full gap-2.5 rounded-xl px-0 text-muted-foreground active:scale-100 lg:min-h-10', collapsed ? 'justify-center' : 'justify-center lg:justify-start lg:px-3')}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className={cn('flex-1 text-left text-body font-normal', label)}>Search</span>
          <kbd className={cn('rounded-md border border-border bg-background px-1.5 py-0.5 text-micro text-muted-foreground', label)}>Ctrl K</kbd>
        </Button>
        <Button
          type="button"
          onClick={onNewTransaction}
          disabled={newTransactionDisabled}
          aria-label="New transaction"
          title={newTransactionDisabled ? 'Reveal sensitive data to make financial changes' : 'New transaction'}
          className={cn('min-h-11 w-full gap-2 px-0 active:scale-100 lg:min-h-10', collapsed ? 'justify-center' : 'justify-center lg:px-4')}
        >
          <Plus className="size-4 shrink-0" strokeWidth={2.25} />
          <span className={label}>New transaction</span>
        </Button>
      </div>

      <nav aria-label="Primary" className="mt-5 flex flex-col gap-0.5 px-3">
        {DESTINATIONS.map(destination => navItem(
          destination.id,
          destination.label,
          <destination.Icon className="size-[1.125rem]" strokeWidth={1.9} />,
          () => onSelectDestination(destination),
          {
            active: activeDestination?.id === destination.id,
            badge: destination.id === 'activity' ? draftCount : undefined,
          },
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-3">
        {failedOpsCount > 0 && (
          <Button
            variant="tertiary"
            type="button"
            role="status"
            aria-label={`${failedOpsCount} failed sync ${failedOpsCount === 1 ? 'item' : 'items'}`}
            onClick={onOpenFailedOps}
            className={cn('mb-2 min-h-10 w-full gap-2 rounded-xl bg-destructive/10 px-0 text-label font-medium text-destructive hover:bg-destructive/15', collapsed ? 'justify-center' : 'justify-center lg:justify-start lg:px-3')}
          >
            <span className="size-2 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
            <span className={label}>{failedOpsCount} failed to sync</span>
          </Button>
        )}
        {navItem('ai', 'Ask AI', <Sparkles className="size-[1.125rem] text-accent-ink" strokeWidth={1.9} />, onAskAI)}
        {navItem(
          'notifications',
          'Bills to review',
          <Bell className="size-[1.125rem]" strokeWidth={1.9} />,
          onOpenNotifications,
          { badge: pendingNotificationCount, badgeTone: 'warning' },
        )}
        {navItem('settings', 'Settings', <Settings className="size-[1.125rem]" strokeWidth={1.9} />, () => onTabChange('settings'), { active: activeTab === 'settings' })}

        {cycleDay !== undefined && !collapsed && (
          <React.Suspense fallback={null}>
            <CycleCard cycleDay={cycleDay} />
          </React.Suspense>
        )}

        {/* Folded to the rail, the account control is just the avatar: the row's name and
            up-down chevron have no room there and would hang past the rail's edge. */}
        <div className={cn('mt-2 border-t border-sidebar-border pt-3', collapsed && 'flex justify-center')}>
          <UserProfileDropdown
            trigger={collapsed ? 'avatar' : 'row'}
            align="start"
            side="top"
            username={username}
            onTabChange={onTabChange}
            hideSensitive={hideSensitive}
            sensitivePreferenceStatus={sensitivePreferenceStatus}
            onToggleHideSensitive={onToggleHideSensitive}
            darkMode={darkMode}
            onToggleDarkMode={onToggleDarkMode}
            onLogout={onLogout}
          />
        </div>
        {collapsed && (
          <Button
            variant="tertiary"
            size="icon"
            type="button"
            aria-label="Expand sidebar"
            title="Expand sidebar"
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-1 hidden text-muted-foreground lg:inline-flex"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
      </div>
    </aside>
  )
}
