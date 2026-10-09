import React from 'react'
import { cn } from '../../lib/utils'
import { Skeleton } from './Skeleton'
import {
  CardSkeleton,
  PlainHeaderSkeleton,
  SettingsHeaderSkeleton,
  ReportsHeaderSkeleton,
  WishlistHeaderSkeleton,
  RewardsPoolSkeleton,
  RecurringHeaderSkeleton,
  BillDayStripSkeleton,
  CarryoverLedgerSkeleton,
  GoalsSectionSkeleton,
  InvestmentSummarySkeleton,
  CycleCalendarSkeleton,
} from './skeletons/FeatureSkeletons'
import { panelClass } from './panelStyles'

const LedgerToolbarSkeleton: React.FC = () => (
  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center rounded-2xl border border-border/60 bg-card p-5">
    <div className="min-w-0 w-full space-y-2 md:flex-1">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-9 w-48 rounded-xl" />
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
          <Skeleton className="h-9 w-0 min-w-0 flex-1 rounded-xl sm:w-56 sm:flex-initial" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-3 w-80 max-w-full" />
    </div>
    <div className="flex w-full gap-2 md:w-auto"><Skeleton className="h-11 flex-1 rounded-xl md:w-32 md:flex-initial" /><Skeleton className="h-11 flex-1 rounded-xl md:w-40 md:flex-initial" /></div>
  </div>
)

const LedgerFilterSkeleton: React.FC = () => (
  <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:gap-4 lg:rounded-2xl lg:p-4">
    <Skeleton className="h-10 flex-1 rounded-xl" />
    <Skeleton className="h-10 w-full rounded-xl sm:w-40" />
    <Skeleton className="h-10 w-full rounded-xl sm:w-44" />
  </div>
)

const CompactMetricGridSkeleton: React.FC<{ count: number; className?: string }> = ({ count, className }) => (
  <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="space-y-2 rounded-control bg-surface-2/70 p-4">
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

const DraftRowSkeleton: React.FC = () => (
  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-2xl border border-border/60 bg-card p-3 shadow-xs sm:gap-x-3 sm:p-4">
    <Skeleton className="size-11 shrink-0 rounded-xl sm:size-9" />
    <div className="min-w-0 space-y-1.5">
      <Skeleton className="h-4 w-40 max-w-full" />
      <div className="flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-5 w-20 rounded-md" />
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

export type PageSkeletonVariant = 'dashboard' | 'reports' | 'ledger' | 'recurring' | 'wishlist' | 'drafts' | 'settings' | 'investments' | 'documents'

const PanelSkeleton = ({ height = 'h-40' }: { height?: string }) => (
  <div className={`${panelClass} p-5`}>
    <Skeleton className="h-4 w-40" />
    <Skeleton className={cn('mt-5 w-full rounded-xl', height)} />
  </div>
)

export const CycleSkeleton: React.FC<{ variant: PageSkeletonVariant; fullPage?: boolean }> = ({ variant, fullPage = false }) => {
  if (variant === 'dashboard') {
    // Mirrors Today's layout -- title, hero, plan tiles beside the reward and bills column -- so
    // the page settles into place rather than reflowing when the data lands.
    return (
      <div data-testid="dashboard-skeleton" className="@container space-y-8">
        <div className="space-y-2.5 pt-1"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-60 max-w-full" /></div>
        <div className={cn(panelClass, 'flex flex-col gap-6 p-5 sm:p-7 @xl:flex-row @xl:items-end @xl:justify-between')}>
          <div className="space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-64 max-w-full @3xl:h-14 @3xl:w-80" /></div>
          <div className="flex items-center gap-4"><Skeleton className="size-16 rounded-full" /><div className="space-y-2"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-40" /></div></div>
        </div>
        <div className="grid gap-8 @4xl:grid-cols-12 @4xl:gap-6">
          <div className="space-y-3 @4xl:col-span-8">
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-3 @lg:grid-cols-2">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className={cn(panelClass, 'space-y-2.5 p-5')}><Skeleton className="h-3.5 w-32" /><Skeleton className="h-6 w-36" /><Skeleton className="h-3 w-44 max-w-full" /></div>
              ))}
            </div>
          </div>
          <div className="grid content-start gap-6 @2xl:grid-cols-2 @4xl:col-span-4 @4xl:grid-cols-1 @4xl:pt-14">
            <CardSkeleton />
            <PanelSkeleton height="h-48" />
          </div>
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
        <div className="grid grid-cols-1 gap-6 min-[1280px]:grid-cols-[minmax(18rem,0.8fr)_minmax(0,2fr)]">
          <PanelSkeleton height="h-56" />
          <CategoryWatchSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 min-[1360px]:grid-cols-2">
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
        <BillDayStripSkeleton />
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 w-20 rounded-full" />)}</div>
          <Skeleton className="hidden h-10 w-52 rounded-full sm:block" />
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
          <div className="divide-y divide-border/60 rounded-panel border border-border/60 bg-card">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
          <div className="hidden space-y-4 rounded-panel border border-border/60 bg-card p-5 xl:block">
            <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-full" /><Skeleton className="h-5 w-32" /></div>
            <Skeleton className="h-8 w-36" />
            {[1, 2, 3, 4].map(row => <div key={row} className="flex justify-between gap-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-28" /></div>)}
          </div>
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
        <GoalsSectionSkeleton kind="commitments" />
        <GoalsSectionSkeleton kind="rewards" />
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
        <div className="grid grid-cols-1 gap-6 min-[1280px]:grid-cols-3 min-[1280px]:items-start">
          <div className={`${panelClass} space-y-5 p-5 min-[1280px]:col-span-2`}>
            <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-64" /></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            <CompactMetricGridSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-2" />
          </div>
          <div className="space-y-6 min-[1280px]:col-span-1">
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
          <div className="space-y-2.5 rounded-control bg-surface-2/70 p-3 lg:flex lg:space-y-0 lg:gap-2.5">
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
