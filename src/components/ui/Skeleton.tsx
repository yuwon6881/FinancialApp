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
 * Full-page skeleton shown while a view's data is refetching for a newly
 * selected cycle (month/year). One shared implementation per variant keeps
 * Dashboard/Ledger/Recurring/Wishlist from drifting into their own
 * hand-rolled `animate-pulse` markup.
 */
export const CycleSkeleton: React.FC<{ variant: 'dashboard' | 'ledger' | 'recurring' | 'wishlist' }> = ({ variant }) => {
  if (variant === 'dashboard') {
    return (
      <div className="space-y-6 soft-rise">
        <CycleHeaderSkeleton subtitleWidth="w-72" controlWidth="w-60" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border/60 space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="flex justify-center py-4">
              <Skeleton className="size-36 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'ledger') {
    return (
      <div className="space-y-6 soft-rise">
        <CycleHeaderSkeleton titleWidth="w-44" subtitleWidth="w-64" controlWidth="w-52" />
        <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => <ListRowSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (variant === 'recurring') {
    return (
      <div className="space-y-6 soft-rise">
        <CycleHeaderSkeleton controlWidth="w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="p-5 rounded-2xl bg-card border border-border/60 space-y-4">
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

  // wishlist — only the rewards banner tiles are cycle-scoped; the goals grid below isn't.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 soft-rise">
      <StatTileSkeleton />
      <StatTileSkeleton />
      <StatTileSkeleton />
    </div>
  )
}
