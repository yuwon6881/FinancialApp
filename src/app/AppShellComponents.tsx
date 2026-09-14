import { type RefObject } from 'react'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { X, Zap } from 'lucide-react'
import { PageContainer } from '../components/ui/PageContainer'

// Instant, flash-free placeholder while a lazily-loaded chunk is fetched at the root level.
export const ViewFallback = () => <div className="app-shell min-h-screen" />

export const CycleSkeletonFallback = () => (
  <div className="space-y-6" aria-hidden="true">
    <Skeleton className="h-40 w-full rounded-2xl" />
    <Skeleton className="h-64 w-full rounded-2xl" />
  </div>
)

export const AppOverlaysFallback = ({
  isOpen,
  visible,
  onAskAi,
  onPostTransaction,
  postTransactionDisabled,
}: {
  isOpen: boolean
  visible: boolean
  onAskAi: () => void
  onPostTransaction: () => void
  postTransactionDisabled: boolean
}) => (
  <>
    {visible && isOpen && (
      <div role="menu" aria-label="Quick actions">
        {/* Same thumb-first order as the loaded menu: Post Transaction sits closest to the
            trigger, the read-only action above it. */}
        <Button
          variant="secondary"
          type="button"
          role="menuitem"
          onClick={onAskAi}
          className="fixed right-8 z-40 flex items-center gap-2.5 cursor-pointer"
          style={{ bottom: 'calc(var(--app-fab-offset) + 7.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <span>Ask AI</span>
        </Button>
        <Button
          variant="secondary"
          type="button"
          role="menuitem"
          onClick={onPostTransaction}
          disabled={postTransactionDisabled}
          title={postTransactionDisabled ? 'Reveal sensitive data to make financial changes' : 'Post Transaction'}
          className="fixed right-8 z-40 flex items-center gap-2.5 cursor-pointer"
          style={{ bottom: 'calc(var(--app-fab-offset) + 4.25rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <span>Post Transaction</span>
        </Button>
      </div>
    )}
  </>
)

export const MobileFabTrigger = ({
  isOpen,
  visible,
  onToggle,
  triggerRef,
}: {
  isOpen: boolean
  visible: boolean
  onToggle: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}) => visible ? (
  <Button size="icon"
    ref={triggerRef}
    variant="tertiary"
    type="button"
    aria-label={isOpen ? 'Close Menu' : 'Open Menu'}
    title={isOpen ? 'Close Menu' : 'Open Menu'}
    onClick={onToggle}
    className="fixed right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/25 cursor-pointer active:scale-95 transition-transform duration-150 sm:hidden"
    style={{ bottom: 'calc(var(--app-fab-offset) + env(safe-area-inset-bottom, 0px))' }}
    aria-expanded={isOpen}
    aria-controls={isOpen ? "mobile-fab-actions" : undefined}
  >
    {isOpen ? <X className="size-6" /> : <Zap className="size-6" />}
  </Button>
) : null

export const AppFooter = () => (
  <footer className="border-t border-border/40 bg-background/45 py-6 pb-nav-safe backdrop-blur select-none sm:pb-6">
    <PageContainer className="text-center text-xs text-muted-foreground sm:ml-20 sm:max-w-[calc(100%-5rem)] lg:ml-56 lg:max-w-[calc(100%-14rem)] 2xl:mx-auto 2xl:max-w-[1440px]">
      &copy; {new Date().getFullYear()} FinancialApp. All rights reserved.
    </PageContainer>
  </footer>
)
