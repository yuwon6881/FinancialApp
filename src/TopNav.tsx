import React from 'react'
import { EyeOff, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from './components/ui/Button'
import { mutationBusyLabel } from './components/ui/rowSyncState'
import { useIsCompact } from './lib/breakpoints'
import { motionSafeScrollBehavior } from './lib/motionPreference'
import { cn } from './lib/utils'
import type { AppTab, PendingNotification } from './types'
import type { SensitivePreferenceStatus } from './app/useAppPreferences'
import type { AppNavigationOptions } from './lib/appLocation'
import { activeSectionId, destinationForTab, landingSection, rememberSection, type Destination } from './components/nav/navModel'
import { Sidebar } from './components/nav/Sidebar'
import { MobileTopBar } from './components/nav/MobileTopBar'
import { TabBar } from './components/nav/TabBar'
import { useAppLocationKey } from './lib/useAppLocationKey'

interface TopNavProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab, options?: AppNavigationOptions) => void
  /** Opens the quick-add sheet (phones). */
  onQuickAdd?: () => void
  quickAddOpen?: boolean
  quickAddTriggerRef?: React.Ref<HTMLButtonElement>
  /** Starts a new transaction straight away (the sidebar's primary action). */
  onNewTransaction?: () => void
  newTransactionDisabled?: boolean
  onAskAI?: () => void
  onOpenSearch?: () => void
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
  /** Cycle start day, for the sidebar's cycle card. */
  cycleDay?: number
}

/**
 * The application chrome: the sidebar from 640px, and on phones a top bar plus the floating tab
 * bar. Owns destination switching (each destination reopens on the section last visited) and the
 * app-wide busy line and privacy notice, so every layout reports the same state the same way.
 */
const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onTabChange,
  onQuickAdd,
  quickAddOpen = false,
  quickAddTriggerRef,
  onNewTransaction,
  newTransactionDisabled = false,
  onAskAI,
  onOpenSearch,
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
  onOpenFailedOps,
  cycleDay,
}) => {
  const isPhone = useIsCompact()
  const syncStatusLabel = syncLabel || mutationBusyLabel('syncing')
  const isBusy = !isOffline && (isSyncing || Boolean(syncLabel))
  const syncStatus = { busy: isBusy || isSyncing, offline: isOffline, label: syncStatusLabel }

  // Remember where in a destination the reader was, so the tab bar and sidebar return them there.
  const locationKey = useAppLocationKey()
  React.useEffect(() => {
    const destination = destinationForTab(activeTab)
    if (!destination?.sections) return
    const section = activeSectionId(destination, activeTab, window.location.pathname, window.location.search)
    if (section && section !== 'review') rememberSection(destination.id, section)
  }, [activeTab, locationKey])

  const selectDestination = React.useCallback((destination: Destination) => {
    if (destinationForTab(activeTab)?.id === destination.id) {
      // Re-selecting where you already are returns to the top, as on every native tab bar.
      window.scrollTo({ top: 0, behavior: motionSafeScrollBehavior() })
      return
    }
    const section = landingSection(destination)
    if (section) {
      onTabChange(section.tab, section.search ? { search: section.search } : undefined)
    } else {
      onTabChange(destination.tabs[0])
    }
  }, [activeTab, onTabChange])

  const pendingNotificationCount = pendingNotifications.length
  const profileProps = {
    username,
    hideSensitive,
    sensitivePreferenceStatus,
    onToggleHideSensitive,
    darkMode,
    onToggleDarkMode,
    onLogout,
  }

  return (
    <>
      {isBusy && (
        <div
          aria-hidden="true"
          data-busy
          className="nav-activity-bar pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-primary/45"
        />
      )}

      {isPhone ? (
        <>
          <MobileTopBar
            activeTab={activeTab}
            onTabChange={onTabChange}
            onOpenSearch={onOpenSearch}
            onAskAI={onAskAI}
            onOpenNotifications={onOpenNotifications}
            pendingNotificationCount={pendingNotificationCount}
            syncStatus={syncStatus}
            retrying={Boolean(syncLabel?.startsWith('Retrying'))}
            draftCount={draftCount}
            failedOpsCount={failedOpsCount}
            onOpenFailedOps={onOpenFailedOps}
            {...profileProps}
          />
          <TabBar
            activeTab={activeTab}
            onSelectDestination={selectDestination}
            onQuickAdd={() => onQuickAdd?.()}
            quickAddOpen={quickAddOpen}
            quickAddTriggerRef={quickAddTriggerRef}
            draftCount={draftCount}
          />
        </>
      ) : (
        <Sidebar
          activeTab={activeTab}
          onSelectDestination={selectDestination}
          onTabChange={onTabChange}
          onNewTransaction={() => onNewTransaction?.()}
          newTransactionDisabled={newTransactionDisabled}
          onOpenSearch={() => onOpenSearch?.()}
          onAskAI={() => onAskAI?.()}
          onOpenNotifications={onOpenNotifications}
          pendingNotificationCount={pendingNotificationCount}
          draftCount={draftCount}
          failedOpsCount={failedOpsCount}
          onOpenFailedOps={() => onOpenFailedOps?.()}
          syncStatus={syncStatus}
          cycleDay={cycleDay}
          {...profileProps}
        />
      )}

      {/* A quiet glass pill, not a warning card: while the preference resolves nothing is wrong,
          the amounts are simply held back. Only the failure case takes the amber attention tone
          and an action. It floats over the page so it never takes layout space. */}
      {sensitivePreferenceStatus !== 'resolved' && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="privacy-status"
          className={cn(
            'pointer-events-none fixed left-1/2 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-50 w-max max-w-[calc(100vw_-_1.5rem)] -translate-x-1/2 lg:top-5',
            'glass-surface rounded-full border border-border/70 shadow-(--app-shadow-overlay)',
            'animate-in fade-in slide-in-from-top-2 duration-200',
            sensitivePreferenceStatus === 'pending' ? 'py-2 pl-2 pr-4' : 'py-1.5 pl-2 pr-1.5',
          )}
        >
          <span className="pointer-events-auto flex items-center gap-2.5">
            {sensitivePreferenceStatus === 'pending' ? (
              <>
                <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-accent-ink">
                  <EyeOff className="size-3.5" aria-hidden="true" />
                  <Loader2 className="absolute inset-0 size-7 animate-spin text-accent-ink/60 [stroke-width:1.25]" aria-hidden="true" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-label text-foreground">Protecting your amounts</span>
                  <span className="sr-only">Checking privacy settings before anything is revealed.</span>
                </span>
              </>
            ) : (
              <>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-label text-foreground">Amounts remain protected</span>
                  <span className="block text-caption text-muted-foreground">Privacy settings couldn't be verified.</span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={onRetrySensitivePreference}
                  className="ml-1 shrink-0"
                >
                  Retry
                </Button>
              </>
            )}
          </span>
        </div>
      )}
    </>
  )
}

export default TopNav
