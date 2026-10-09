import React from 'react'
import { Bell, Search, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { AppLogo } from '../ui/AppLogo'
import { cn } from '../../lib/utils'
import type { AppTab } from '../../types'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { destinationForTab } from './navModel'
import { UserProfileDropdown } from './UserProfileDropdown'

export interface MobileTopBarProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  onOpenSearch?: () => void
  onAskAI?: () => void
  onOpenNotifications: () => void
  pendingNotificationCount: number
  syncStatus: { busy: boolean; offline: boolean; label?: string }
  retrying?: boolean
  draftCount: number
  failedOpsCount: number
  onOpenFailedOps?: () => void
  username: string
  hideSensitive: boolean
  sensitivePreferenceStatus: SensitivePreferenceStatus
  onToggleHideSensitive: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
}

/** True once the page has scrolled past `threshold`, read once per frame at most. */
function useScrolledPast(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setScrolled(window.scrollY > threshold)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [threshold])
  return scrolled
}

/**
 * The phone top bar. At the top of a page it is transparent and lets the page's own large title
 * lead; once the page scrolls it gains glass and a hairline, and the destination name fades in --
 * the large-title pattern, without stealing vertical space from the content.
 */
export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  activeTab,
  onTabChange,
  onOpenSearch,
  onAskAI,
  onOpenNotifications,
  pendingNotificationCount,
  syncStatus,
  retrying = false,
  draftCount,
  failedOpsCount,
  onOpenFailedOps,
  username,
  hideSensitive,
  sensitivePreferenceStatus,
  onToggleHideSensitive,
  darkMode,
  onToggleDarkMode,
  onLogout,
}) => {
  const scrolled = useScrolledPast(12)
  const title = activeTab === 'settings' ? 'Settings' : destinationForTab(activeTab)?.label ?? ''
  const hasAlerts = pendingNotificationCount > 0

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b transition-[background-color,border-color,backdrop-filter] duration-200 ease-fluid sm:hidden',
        scrolled ? 'glass-nav border-border/60' : 'border-transparent bg-transparent',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex h-14 items-center gap-1 px-3">
        <Button
          variant="tertiary"
          type="button"
          aria-label="Go to Today"
          onClick={() => onTabChange('dashboard')}
          className="brand-home-button min-h-11 min-w-11 shrink-0 rounded-full p-0 hover:bg-transparent"
        >
          <span className="relative">
            <AppLogo className="size-8 rounded-[0.625rem]" />
            {(syncStatus.offline || syncStatus.busy) && (
              <span
                role="status"
                aria-label={syncStatus.offline ? 'Offline' : syncStatus.label ?? 'Syncing'}
                title={syncStatus.offline ? 'No network connection — showing saved data; changes will sync when you are back online' : syncStatus.label}
                className={cn('absolute -right-1 -top-1 size-3 rounded-full border-2 border-background', syncStatus.offline ? 'bg-amber-500' : 'animate-pulse bg-primary')}
              />
            )}
          </span>
        </Button>

        <div className="min-w-0 flex-1 pl-1">
          <span
            aria-hidden={!scrolled}
            className={cn('block truncate text-subsection text-foreground transition-[opacity,transform] duration-200 ease-fluid', scrolled ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0')}
          >
            {title}
          </span>
        </div>

        {(syncStatus.offline || retrying) && (
          <span
            role="status"
            className={cn('shrink-0 rounded-full px-2 py-0.5 text-caption font-medium', syncStatus.offline ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300' : 'bg-primary/12 text-accent-ink')}
          >
            {syncStatus.offline ? 'Offline' : syncStatus.label}
          </span>
        )}
        {failedOpsCount > 0 && (
          <Button
            variant="tertiary"
            type="button"
            role="status"
            aria-label={`${failedOpsCount} failed sync ${failedOpsCount === 1 ? 'item' : 'items'}`}
            onClick={() => onOpenFailedOps?.()}
            className="min-h-8 shrink-0 gap-1 rounded-full bg-destructive/10 px-2.5 text-caption font-medium text-destructive hover:bg-destructive/15"
          >
            <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            {failedOpsCount} failed
          </Button>
        )}
        {draftCount > 0 && (
          <Button
            variant="tertiary"
            type="button"
            onClick={() => onTabChange('drafts')}
            title="Draft transactions waiting to be synced to the server"
            className="min-h-8 shrink-0 rounded-full bg-amber-500/12 px-2.5 text-caption font-medium text-amber-700 hover:bg-amber-500/18 dark:text-amber-300"
          >
            {draftCount} Draft{draftCount > 1 ? 's' : ''}
          </Button>
        )}

        {onOpenSearch && (
          <IconButton label="Search your records" onClick={onOpenSearch} className="text-muted-foreground">
            <Search className="size-[1.125rem]" />
          </IconButton>
        )}
        {onAskAI && (
          <IconButton label="ASK AI" tooltip="Ask AI" onClick={onAskAI} className="text-accent-ink">
            <Sparkles className="size-[1.125rem]" />
          </IconButton>
        )}
        <IconButton
          label={hasAlerts ? `Review ${pendingNotificationCount} pending bills` : 'Bills: all caught up'}
          tooltip={hasAlerts ? `${pendingNotificationCount} bills need review` : 'No bills need review'}
          onClick={onOpenNotifications}
          className="relative text-muted-foreground"
        >
          <Bell className="size-[1.125rem]" />
          {hasAlerts && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-amber-500 ring-2 ring-background" />}
        </IconButton>
        <UserProfileDropdown
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
    </header>
  )
}
