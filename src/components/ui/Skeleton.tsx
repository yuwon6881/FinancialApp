import React from 'react'
import { cn } from '../../lib/utils'
import { Card } from './Card'

/**
 * Elegant shimmering skeleton loader — a soft gradient sweeps across a muted
 * base instead of a jarring pulse or spinner. See `.skeleton-shimmer` in
 * index.css (respects prefers-reduced-motion).
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('skeleton-shimmer rounded-md', className)} />
)

export const CardSkeleton: React.FC = () => (
  <div className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="size-8 rounded-lg" />
    </div>
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-3 h-2 w-full" />
    <Skeleton className="mt-2 h-2 w-2/3" />
  </div>
)

/**
 * The title/subtitle + control row shared by every view's header panel.
 * Used as the top of CycleSkeleton so all cycle-switch skeletons line up
 * with the real header layout instead of drifting apart per-view.
 */
export const CycleHeaderSkeleton: React.FC<{
  titleWidth?: string
  subtitleWidth?: string
  controlWidth?: string
}> = ({ titleWidth = 'w-48', subtitleWidth = 'w-64', controlWidth = 'w-52' }) => (
  <Card className="flex flex-col md:flex-row items-center justify-between gap-4">
    <div className="space-y-2 w-full md:w-auto">
      <Skeleton className={cn('h-6', titleWidth)} />
      <Skeleton className={cn('h-3', subtitleWidth)} />
    </div>
    <Skeleton className={cn('h-9 rounded-xl', controlWidth)} />
  </Card>
)

/** A single stat tile placeholder, matching the small banner cards used on Wishlist/Dashboard. */
export const StatTileSkeleton: React.FC = () => (
  <Card className="p-5 flex items-center justify-between">
    <div className="space-y-2">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="h-5 w-20" />
    </div>
    <Skeleton className="size-10 rounded-xl" />
  </Card>
)

/** A single list-row placeholder, matching Ledger's transaction rows. */
const ListRowSkeleton: React.FC = () => (
  <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-border/30 bg-background/50">
    <div className="flex items-center gap-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-36" />
    </div>
    <div className="flex items-center gap-4">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-24" />
    </div>
  </div>
)

/**
 * Layout-specific skeletons shared by initial loading, lazy page transitions,
 * and cycle refreshes. Keeping them here prevents placeholders from drifting
 * away from the current page structures.
 */
export type PageSkeletonVariant = 'dashboard' | 'reports' | 'ledger' | 'recurring' | 'wishlist' | 'drafts' | 'settings'

const PanelSkeleton = ({ height = 'h-40' }: { height?: string }) => (
  <div className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
    <Skeleton className="h-4 w-40" />
    <Skeleton className={cn('mt-5 w-full rounded-xl', height)} />
  </div>
)

export const CycleSkeleton: React.FC<{ variant: PageSkeletonVariant; fullPage?: boolean }> = ({ variant, fullPage = false }) => {
  if (variant === 'dashboard') {
    return (
      <div data-testid="dashboard-skeleton" className="space-y-6 soft-rise">
        <CycleHeaderSkeleton subtitleWidth="w-72" controlWidth="w-60" />
        <PanelSkeleton height="h-12" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <PanelSkeleton height="h-36" />
          <PanelSkeleton height="h-36" />
        </div>
      </div>
    )
  }

  if (variant === 'reports') {
    return (
      <div data-testid="reports-skeleton" className="space-y-6 soft-rise">
        <CycleHeaderSkeleton titleWidth="w-28" subtitleWidth="w-72" controlWidth="w-80" />
        <PanelSkeleton height="h-28" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
          <PanelSkeleton height="h-56" />
          <PanelSkeleton height="h-56" />
        </div>
        <PanelSkeleton height="h-72" />
      </div>
    )
  }

  if (variant === 'ledger') {
    return (
      <div data-testid="ledger-skeleton" className="space-y-6 soft-rise">
        <CycleHeaderSkeleton titleWidth="w-44" subtitleWidth="w-64" controlWidth="w-52" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl sm:w-48" />
        </div>
        <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => <ListRowSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (variant === 'recurring') {
    return (
      <div data-testid="recurring-skeleton" className="space-y-6 soft-rise">
        <CycleHeaderSkeleton controlWidth="w-40" />
        <PanelSkeleton height="h-36" />
        <Skeleton className="h-10 w-full rounded-xl sm:w-72" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="min-w-0 space-y-4 rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'wishlist') {
    return (
      <div data-testid="wishlist-skeleton" className="space-y-6 soft-rise">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>
        {fullPage && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <PanelSkeleton height="h-72" />
            <PanelSkeleton height="h-72" />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'settings') {
    return (
      <div data-testid="settings-skeleton" className="space-y-6 soft-rise">
        <CycleHeaderSkeleton titleWidth="w-28" subtitleWidth="w-80" controlWidth="w-0" />
        <div className="flex gap-6 border-b border-border/30 pb-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="app-panel space-y-5 rounded-2xl border border-border/60 bg-card/92 p-5">
          <Skeleton className="h-5 w-36" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="drafts-skeleton" className="space-y-6 soft-rise">
      <CycleHeaderSkeleton titleWidth="w-40" subtitleWidth="w-64" controlWidth="w-36" />
      <div className="app-panel space-y-3 rounded-2xl border border-border/60 bg-card/92 p-4">
        {[1, 2, 3, 4].map(i => <ListRowSkeleton key={i} />)}
      </div>
    </div>
  )
}
