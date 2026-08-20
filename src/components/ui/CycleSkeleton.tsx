import React from 'react'
import { cn } from '../../lib/utils'
import { Card } from './Card'
import { Skeleton } from './Skeleton'

const panelClass = 'app-panel rounded-2xl border border-border/60 bg-card/92'

const CardSkeleton: React.FC = () => (
  <div className={`${panelClass} p-5`}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="size-8 rounded-lg" />
    </div>
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-3 h-2 w-full" />
    <Skeleton className="mt-2 h-2 w-2/3" />
  </div>
)

const PlainHeaderSkeleton: React.FC<{ backButton?: boolean }> = ({ backButton = false }) => (
  <div className="flex items-start gap-3">
    {backButton && <Skeleton className="size-9 shrink-0 rounded-xl" />}
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3 w-72 max-w-full" />
    </div>
  </div>
)

const SettingsHeaderSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
    <div className="flex items-center gap-2"><Skeleton className="size-5 rounded-md" /><Skeleton className="h-6 w-28" /></div>
    <Skeleton className="h-3 w-80 max-w-full" />
  </div>
)

const ReportsHeaderSkeleton: React.FC = () => (
  <div className={`${panelClass} p-4 sm:p-6`}>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-3 w-72 max-w-full" /></div></div>
      <div data-testid="reports-skeleton-controls" className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2 lg:w-auto"><Skeleton className="h-11 w-0 min-w-0 flex-1 rounded-xl sm:h-10 sm:w-52 sm:flex-initial" /><Skeleton className="h-11 w-28 shrink-0 rounded-xl sm:h-10" /><Skeleton className="size-11 shrink-0 rounded-lg sm:h-10 sm:w-24" /><Skeleton className="size-11 shrink-0 rounded-lg sm:h-10 sm:w-40" /></div>
    </div>
  </div>
)

const DashboardHeaderSkeleton: React.FC = () => (
  <div className={`${panelClass} overflow-hidden`}>
    <div className="grid gap-5 rounded-2xl bg-linear-to-br from-blue-500/10 via-transparent to-teal-500/10 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,25rem)] lg:items-center">
      <div className="flex items-center gap-3"><Skeleton className="size-11 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-32" /><Skeleton className="h-3 w-48" /></div></div>
      <div className="space-y-3 rounded-2xl border border-border/60 bg-background/65 p-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-36" /><Skeleton className="h-3 w-40" /></div>
    </div>
  </div>
)

const WishlistHeaderSkeleton: React.FC = () => (
  <div data-testid="wishlist-header-skeleton" className={`${panelClass} flex items-center justify-between gap-3 p-4 sm:p-5`}>
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="hidden h-3 w-72 max-w-full sm:block" />
    </div>
    <Skeleton className="h-9 w-32 shrink-0 rounded-xl" />
  </div>
)

const RewardsPoolSkeleton: React.FC = () => (
  <Card data-testid="wishlist-pool-skeleton" className="space-y-3 p-3 sm:space-y-4 sm:p-5">
    <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
      <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-32" /></div>
      <div className="flex items-center justify-end gap-2"><Skeleton className="h-8 w-20 rounded-xl" /><Skeleton className="h-8 w-32 rounded-xl" /></div>
    </div>
    <Skeleton className="h-2.5 w-full rounded-full" />
    <div className="grid grid-cols-2 gap-2"><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /></div>
    <div className="space-y-2 rounded-xl border border-border/50 bg-muted/25 p-3">
      <div className="flex justify-between gap-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-36" /></div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3 w-64 max-w-full" />
    </div>
  </Card>
)

const RecurringHeaderSkeleton: React.FC = () => (
  <Card className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
    <div className="min-w-0 w-full md:flex-1">
      <Skeleton className="h-6 w-72 max-w-full" />
      <Skeleton className="mt-1 h-3 w-48" />
      <div className="mt-4 grid min-w-0 grid-cols-3">
        <div className="min-w-0 space-y-1.5 pr-2"><Skeleton className="h-2.5 w-16 max-w-full" /><Skeleton className="h-7 w-20 max-w-full" /></div>
        <div className="min-w-0 space-y-1.5 border-l border-border/60 px-2"><Skeleton className="h-2.5 w-16 max-w-full" /><Skeleton className="h-7 w-20 max-w-full" /></div>
        <div className="min-w-0 space-y-1.5 border-l border-border/60 pl-2"><Skeleton className="h-2.5 w-16 max-w-full" /><Skeleton className="h-7 w-12 max-w-full" /></div>
      </div>
    </div>
    <Skeleton className="h-11 w-44 rounded-xl" />
  </Card>
)

const BillTimelineSkeleton: React.FC = () => (
  <Card className="space-y-6">
    <div className="flex items-center justify-between gap-3 border-b border-border/30 pb-3">
      <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-3 w-72 max-w-full" /></div>
      <Skeleton className="size-8 rounded-lg" />
    </div>
    <Skeleton className="h-72 w-full rounded-2xl sm:h-[26rem]" />
  </Card>
)

const LedgerToolbarSkeleton: React.FC = () => (
  <Card className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-3"><Skeleton className="h-6 w-44" /><Skeleton className="h-9 w-56 rounded-xl" /><Skeleton className="h-9 w-28 rounded-xl" /></div>
      <Skeleton className="h-3 w-80 max-w-full" />
    </div>
    <div className="flex w-full gap-2 md:w-auto"><Skeleton className="h-11 flex-1 rounded-xl md:w-32 md:flex-initial" /><Skeleton className="h-11 flex-1 rounded-xl md:w-40 md:flex-initial" /></div>
  </Card>
)

const LedgerFilterSkeleton: React.FC = () => (
  <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:gap-4 lg:rounded-2xl lg:p-4">
    <Skeleton className="h-10 flex-1 rounded-xl" />
    <Skeleton className="h-10 w-full rounded-xl sm:w-40" />
    <Skeleton className="h-10 w-full rounded-xl sm:w-44" />
  </div>
)

const CarryoverLedgerSkeleton: React.FC = () => (
  <div className={`${panelClass} space-y-4 p-6`}>
    <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-3 w-80 max-w-full" /></div>
    <div className="hidden overflow-x-hidden md:block">
      <div className="grid grid-cols-6 gap-4 border-b border-border/50 px-4 pb-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-28" /></div>
      <div className="space-y-1.5 pt-2">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="grid grid-cols-6 items-center gap-4 rounded-xl px-4 py-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-14" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-24 justify-self-end rounded-lg" /></div>)}</div>
    </div>
    <div className="grid grid-cols-1 gap-4 md:hidden">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="space-y-3 rounded-xl border border-border bg-background/50 p-4"><div className="flex justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16 rounded-md" /></div><div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-3"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-24" /></div><div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" /></div></div>)}</div>
  </div>
)

const HorizontalRailSkeleton: React.FC<{ kind: 'commitments' | 'rewards'; cards?: number }> = ({ kind, cards = 3 }) => (
  <section className={`${panelClass} space-y-3 rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:bg-card/92 sm:p-5 sm:shadow-xs`}>
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-2.5 w-64 max-w-full" /></div>
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
    <div className="group/horizontal-rail relative min-w-0">
      <div className="horizontal-rail no-scrollbar flex w-full min-w-0 gap-3 overflow-hidden pb-1">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="snap-start flex w-[calc(100vw-3.5rem)] shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-xs sm:w-[22rem]">
          <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-2.5 w-28" /></div>
          <div className="space-y-2"><div className="flex justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-3 w-20" /></div><Skeleton className="h-1.5 w-full rounded-full" /></div>
          {kind === 'commitments' ? (
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/25 p-2.5"><div className="flex justify-between"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-2.5 w-24" /></div><Skeleton className="h-1 w-full rounded-full" /><Skeleton className="h-3 w-36" /></div>
          ) : <Skeleton className="h-3 w-36" />}
          <div className="mt-auto flex items-center gap-1.5 border-t border-border/30 pt-3">
            {kind === 'commitments' ? <><Skeleton className="size-8 rounded-lg" /><Skeleton className="size-8 rounded-lg" /></> : <Skeleton className="h-8 w-20 rounded-lg" />}
            {kind === 'commitments' ? <Skeleton className="size-8 rounded-lg" /> : <Skeleton className="size-8 rounded-lg" />}
            <Skeleton className="ml-auto size-8 rounded-lg" />
          </div>
        </div>
      ))}
      </div>
      <Skeleton className="absolute left-2 top-1/2 size-8 -translate-y-1/2 rounded-full" />
      <Skeleton className="absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full" />
    </div>
  </section>
)

const CompactMetricGridSkeleton: React.FC<{ count: number; className?: string }> = ({ count, className }) => (
  <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="space-y-2 rounded-xl border border-border/50 bg-muted/25 p-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    ))}
  </div>
)

const CategoryWatchSkeleton: React.FC = () => (
  <div className={`${panelClass} space-y-4 p-5`}>
    <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-56 max-w-full" /></div>
    <CompactMetricGridSkeleton count={3} className="lg:grid-cols-3" />
  </div>
)

const FinancialPlanSkeleton: React.FC = () => (
  <div className={`${panelClass} space-y-4 p-6`}>
    <div className="space-y-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-80 max-w-full" /></div>
    <div className="flex gap-4"><Skeleton className="h-2 w-24" /><Skeleton className="h-2 w-32" /></div>
    <CompactMetricGridSkeleton count={3} className="gap-6 xl:grid-cols-3" />
  </div>
)

const InvestmentSummarySkeleton: React.FC = () => (
  <div className={`${panelClass} flex flex-col p-4`}>
    <div className="flex items-center justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="size-8 rounded-lg" /></div>
    <Skeleton className="mt-3 h-6 w-32" />
    <div className="mt-3 space-y-2 border-t border-border/40 pt-1"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
  </div>
)

/** A single list-row placeholder, matching Ledger's transaction rows. */
const ListRowSkeleton: React.FC = () => (
  <div className="flex items-center justify-between min-w-0 gap-2 py-3 px-3 sm:px-4 rounded-xl border border-border/30 bg-background/50">
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <Skeleton className="h-4 w-12 sm:w-20 shrink-0" />
      <Skeleton className="h-4 w-24 sm:w-36 truncate" />
    </div>
    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
      <Skeleton className="h-5 w-14 sm:w-20 rounded-full" />
      <Skeleton className="h-5 w-16 sm:w-24" />
    </div>
  </div>
)

/** A draft-row placeholder matching DraftStagingView's centered amount and separate category row. */
const DraftRowSkeleton: React.FC = () => (
  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
    <div className="min-w-0 space-y-1.5">
      <Skeleton className="h-4 w-40 max-w-full" />
      <div className="flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
    <Skeleton className="h-4 w-16 max-w-full self-center" />
  </div>
)

/**
 * Layout-specific skeletons shared by initial loading, lazy page transitions,
 * and cycle refreshes. Keeping them here prevents placeholders from drifting
 * away from the current page structures.
 */
export type PageSkeletonVariant = 'dashboard' | 'reports' | 'ledger' | 'recurring' | 'wishlist' | 'drafts' | 'settings' | 'investments' | 'documents'

const PanelSkeleton = ({ height = 'h-40' }: { height?: string }) => (
  <div className={`${panelClass} p-5`}>
    <Skeleton className="h-4 w-40" />
    <Skeleton className={cn('mt-5 w-full rounded-xl', height)} />
  </div>
)

const CycleCalendarSkeleton = () => (
  <div className={`${panelClass} p-4 sm:p-6`}>
    <div className="space-y-2">
      <div className="flex items-center gap-2"><Skeleton className="h-5 w-28" /><Skeleton className="size-7 rounded-full" /></div>
      <Skeleton className="h-3 w-40" />
      <div className="flex items-center gap-1.5"><Skeleton className="h-3 w-16" />{[1, 2, 3, 4].map(level => <Skeleton key={level} className="size-3 rounded-sm" />)}<Skeleton className="h-3 w-20" /></div>
    </div>
    <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
      {Array.from({ length: 7 }).map((_, index) => <Skeleton key={`weekday-${index}`} className="mx-auto h-3 w-7" />)}
      {Array.from({ length: 35 }).map((_, index) => <Skeleton key={`day-${index}`} className="h-11 w-full rounded-lg sm:h-14 sm:rounded-xl md:h-16" />)}
    </div>
  </div>
)

export const CycleSkeleton: React.FC<{ variant: PageSkeletonVariant; fullPage?: boolean }> = ({ variant, fullPage = false }) => {
  if (variant === 'dashboard') {
    return (
      <div data-testid="dashboard-skeleton" className="space-y-6">
        <DashboardHeaderSkeleton />
        <div className={`${panelClass} flex items-center gap-3 p-5`}><Skeleton className="size-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="hidden h-9 w-28 rounded-xl sm:block" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className={`${panelClass} space-y-5 p-5`}>
          <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-72 max-w-full" /></div>
          <CompactMetricGridSkeleton count={6} />
          <div className="flex justify-end"><Skeleton className="h-8 w-32 rounded-lg" /></div>
        </div>
      </div>
    )
  }

  if (variant === 'reports') {
    return (
      <div data-testid="reports-skeleton" className="space-y-6">
        <ReportsHeaderSkeleton />
        <PanelSkeleton height="h-20" />
        <CarryoverLedgerSkeleton />
        <FinancialPlanSkeleton />
        <div className={`${panelClass} flex items-center justify-between gap-4 p-5`}><div className="flex items-center gap-3"><Skeleton className="size-11 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-64 max-w-full" /></div></div><Skeleton className="h-6 w-28" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,2fr)]">
          <PanelSkeleton height="h-56" />
          <CategoryWatchSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PanelSkeleton height="h-64" />
          <PanelSkeleton height="h-64" />
        </div>
        <CycleCalendarSkeleton />
      </div>
    )
  }

  if (variant === 'ledger') {
    return (
      <div data-testid="ledger-skeleton" className="space-y-6 w-full min-w-0 overflow-hidden">
        <LedgerToolbarSkeleton />
        <LedgerFilterSkeleton />
        <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-4 space-y-3 min-w-0 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => <ListRowSkeleton key={i} />)}
        </div>
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row"><Skeleton className="h-4 w-48" /><div className="flex gap-2"><Skeleton className="h-8 w-20 rounded-lg" /><Skeleton className="h-8 w-24 rounded-lg" /><Skeleton className="h-8 w-20 rounded-lg" /></div></div>
      </div>
    )
  }

  if (variant === 'recurring') {
    return (
      <div data-testid="recurring-skeleton" className="space-y-6">
        <RecurringHeaderSkeleton />
        <div className="flex gap-2 rounded-xl bg-muted/40 p-1">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-lg" />
        </div>
        <BillTimelineSkeleton />
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-xs sm:flex-row">
          <Skeleton className="h-10 w-full rounded-xl sm:w-60" />
          <Skeleton className="h-10 w-full rounded-xl sm:w-60" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="min-w-0 space-y-4 rounded-2xl border border-border/60 bg-card p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-36 rounded-lg" />
              <div className="mt-2 space-y-3 border-t border-border/30 pt-4">
                {[1, 2, 3, 4].map(row => <div key={row} className="flex items-center justify-between gap-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-32" /></div>)}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/30 pt-4"><Skeleton className="h-9 w-24 rounded-lg" /><div className="flex gap-2"><Skeleton className="size-9 rounded-lg" /><Skeleton className="size-9 rounded-lg" /></div></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'wishlist') {
    return (
      <div data-testid="wishlist-skeleton" className="space-y-5">
        {fullPage && <WishlistHeaderSkeleton />}
        <RewardsPoolSkeleton />
        {fullPage && (
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex gap-1.5 rounded-xl bg-muted/40 p-1">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        )}
        <HorizontalRailSkeleton kind="commitments" />
        <HorizontalRailSkeleton kind="rewards" />
      </div>
    )
  }

  if (variant === 'settings') {
    return (
      <div data-testid="settings-skeleton" className="space-y-6">
        <SettingsHeaderSkeleton />
        <div className="flex flex-wrap gap-3 sm:gap-6 border-b border-border/30 pb-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div className={`${panelClass} space-y-5 p-5 lg:col-span-2`}>
            <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-64" /></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            <CompactMetricGridSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-2" />
          </div>
          <div className="space-y-6 lg:col-span-1">
            <div className={`${panelClass} space-y-4 p-5`}>
              <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-full" /></div>
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
            <div className={`${panelClass} space-y-4 p-5`}>
              <div className="space-y-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-3 w-full" /></div>
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'investments') {
    return (
      <div data-testid="investments-skeleton" className="space-y-6">
        <PlainHeaderSkeleton backButton />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <InvestmentSummarySkeleton key={i} />)}
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-card/92 p-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 w-28 rounded-xl" />)}</div>
        <div className={`${panelClass} space-y-5 p-5`}><div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-72 max-w-full" /></div><CompactMetricGridSkeleton count={3} /></div>
        <div className={`${panelClass} flex items-center justify-between gap-3 p-4`}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="size-4 rounded-md" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <PanelSkeleton height="h-64" />
          <PanelSkeleton height="h-64" />
        </div>
        <PanelSkeleton height="h-72" />
        <PanelSkeleton height="h-56" />
        <PanelSkeleton height="h-64" />
        <PanelSkeleton height="h-72" />
      </div>
    )
  }

  if (variant === 'documents') {
    return (
      <div data-testid="documents-skeleton" className="space-y-5">
        {/* Mirrors DocumentsView: header actions, a Vault-insights panel, then a
            separate document-management panel with filters beside the records. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Skeleton className="size-8 rounded-xl" /><Skeleton className="h-6 w-40" /></div>
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Skeleton className="h-11 w-full rounded-xl sm:w-36" /><Skeleton className="h-11 w-full rounded-xl sm:w-24" /></div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="mt-4 h-32 w-full rounded-2xl" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:p-4">
          <div className="mb-3 flex items-end justify-between gap-3 px-3">
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-56 max-w-full" /></div>
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
          <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3 lg:flex lg:space-y-0 lg:gap-2.5">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <div className="grid grid-cols-2 gap-2 lg:w-80"><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-10 rounded-xl" /></div>
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <ListRowSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section data-testid="drafts-skeleton" className="mx-auto max-w-4xl space-y-5" aria-label="Loading draft transactions">
      <div className={`${panelClass} p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2"><Skeleton className="size-5 rounded-md" /><Skeleton className="h-6 w-48" /><Skeleton className="h-5 w-8 rounded-full" /></div>
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <DraftRowSkeleton key={i} />)}
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <div className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xs"><Skeleton className="h-11 w-full rounded-xl" /></div>
    </section>
  )
}
