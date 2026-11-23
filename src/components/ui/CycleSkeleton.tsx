import React from 'react'
import { cn } from '../../lib/utils'
import { Skeleton } from './Skeleton'
import {
  CardSkeleton,
  ReportsHeaderSkeleton,
  RewardsPoolSkeleton,
  RecurringHeaderSkeleton,
  BillDayStripSkeleton,
  ReportBucketsSkeleton,
  GoalsSectionSkeleton,
  CycleCalendarSkeleton,
  LoansSectionSkeleton,
} from './skeletons/FeatureSkeletons'
import { panelClass } from './panelStyles'
import { PageHeader } from './PageHeader'
import { AccountsPageSkeleton, BudgetSkeleton, SettingsPageSkeleton } from './skeletons/SettingsPageSkeletons'
import { InvestmentPageSkeleton, VaultPageSkeleton } from './skeletons/WealthPageSkeletons'
import { ForecastPageSkeleton } from './skeletons/ForecastPageSkeleton'

const LedgerToolbarSkeleton: React.FC = () => (
  <PageHeader
    title={<Skeleton className="h-7 w-32 sm:h-[34px] sm:w-40" />}
    titleActions={<Skeleton className="h-13 w-44 rounded-full lg:h-11" />}
    actionsClassName="hidden sm:flex"
    actions={<><Skeleton className="h-11 w-28 rounded-full lg:h-9" /><Skeleton className="h-11 w-36 rounded-full lg:h-9" /></>}
  />
)

const LedgerFilterSkeleton: React.FC = () => (
  <div className="flex flex-wrap gap-2 py-2">
    <Skeleton className="h-11 min-w-36 flex-1 rounded-full" />
    <Skeleton className="h-11 w-11 rounded-full max-sm:block sm:hidden" />
    <Skeleton className="h-11 w-11 rounded-full lg:w-24" />
  </div>
)

const ListRowSkeleton: React.FC = () => (
  <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
    <Skeleton className="size-10 shrink-0 rounded-control" />
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className="h-3.5 w-40 max-w-full" />
      <Skeleton className="h-3 w-24 max-w-full" />
    </div>
    <Skeleton className="h-3.5 w-16 shrink-0" />
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

export type PageSkeletonVariant = 'dashboard' | 'reports' | 'ledger' | 'recurring' | 'wishlist' | 'drafts' | 'settings' | 'budget' | 'budget-categories' | 'accounts' | 'loans' | 'investments' | 'documents' | 'forecast'

const PanelSkeleton = ({ height = 'h-40' }: { height?: string }) => (
  <div className={`${panelClass} p-5`}>
    <Skeleton className="h-4 w-40" />
    <Skeleton className={cn('mt-5 w-full rounded-xl', height)} />
  </div>
)

export const CycleSkeleton: React.FC<{ variant: PageSkeletonVariant; fullPage?: boolean; goalsTab?: 'commitments' | 'rewards'; showEssentialsPool?: boolean }> = ({ variant, fullPage = false, goalsTab = 'commitments', showEssentialsPool = false }) => {
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
    // Mirrors Insights: the cycle hero with its glance strip, the buckets, "Where it went", the
    // subscriptions beside the Growth trend, then the calendar with its weekly pacing.
    return (
      <div data-testid="reports-skeleton" className="@container space-y-8">
        <ReportsHeaderSkeleton />
        <div className={cn(panelClass, '@container overflow-hidden')}>
          <div className="flex flex-col gap-5 p-5 sm:p-6 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-10">
            <div className="space-y-3 @3xl:max-w-md @3xl:flex-1"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-10 w-52 max-w-full @xs:h-11" /><Skeleton className="h-1.5 w-full rounded-full" /><Skeleton className="h-3 w-40" /></div>
            <div className="grid grid-cols-1 gap-2 @xs:grid-cols-2 @3xl:w-[26rem]">
              {[1, 2].map(i => <div key={i} className="space-y-2 rounded-control bg-inset p-3.5"><Skeleton className="h-3.5 w-16" /><Skeleton className="h-5 w-24" /><Skeleton className="h-3 w-28 max-w-full" /></div>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 @xl:grid-cols-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="space-y-1.5 bg-card px-4 py-3.5 sm:px-6"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-14" /></div>)}
          </div>
        </div>
        <ReportBucketsSkeleton />
        <div className="space-y-3">
          <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3.5 w-80 max-w-full" /></div>
          <div className={cn(panelClass, 'grid gap-6 p-4 sm:p-5 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
            <div className="space-y-5">
              <div className="flex flex-wrap justify-between gap-3"><div className="space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-44" /></div><Skeleton className="h-11 w-48 rounded-full lg:h-9" /></div>
              <div className="flex flex-col items-center gap-5 @sm:flex-row"><Skeleton className="size-44 shrink-0 rounded-full" /><div className="w-full space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-3.5 w-full" />)}</div></div>
            </div>
            <div className="space-y-4 border-t border-border/60 pt-5 @4xl:border-l @4xl:border-t-0 @4xl:pl-6 @4xl:pt-0">
              <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-28" /></div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3"><Skeleton className="size-8 shrink-0 rounded-[0.625rem]" /><div className="flex-1 space-y-2"><div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-3.5 w-28" /></div><Skeleton className="h-1.5 w-full rounded-full" /></div></div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 @4xl:grid-cols-2 @4xl:gap-6">
          {[1, 2].map(i => (
            <div key={i} className="space-y-3">
              <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3.5 w-48" /></div>
              <PanelSkeleton height="h-48" />
            </div>
          ))}
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
        <div className="min-w-0 divide-y divide-border/60 overflow-hidden rounded-panel border border-border/70 bg-card">
          {[1, 2, 3, 4, 5, 6].map(i => <ListRowSkeleton key={i} />)}
        </div>
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row"><Skeleton className="h-4 w-48" /><div className="flex gap-2"><Skeleton className="h-8 w-20 rounded-lg" /><Skeleton className="h-8 w-24 rounded-lg" /><Skeleton className="h-8 w-20 rounded-lg" /></div></div>
      </div>
    )
  }

  if (variant === 'loans') {
    return (
      <div data-testid="loans-skeleton" className="space-y-6">
        <RecurringHeaderSkeleton loans />
        <LoansSectionSkeleton />
      </div>
    )
  }

  if (variant === 'recurring') {
    return (
      <div data-testid="recurring-skeleton" className="space-y-6">
        <RecurringHeaderSkeleton />
        <BillDayStripSkeleton />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 gap-1.5 overflow-hidden">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-full" />)}</div>
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
      <div data-testid="wishlist-skeleton" className="@container space-y-5">
        {fullPage && (
          <>
            <PageHeader title={<Skeleton className="h-7 w-24 sm:h-[34px]" />} titleActions={<Skeleton className="h-11 w-32 rounded-full lg:h-9" />} />
            <div className="flex h-[45px] items-center gap-5 border-b border-border/70 lg:h-[37px]">
              <Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-20" />
            </div>
          </>
        )}
        <div className="grid min-w-0 items-start gap-5 @5xl:grid-cols-[minmax(0,1fr)_22rem] @5xl:gap-6">
          <div className="space-y-3 @5xl:col-start-2 @5xl:row-start-1">
            <RewardsPoolSkeleton />
            {showEssentialsPool && <RewardsPoolSkeleton />}
          </div>
          <div className="min-w-0 @5xl:col-start-1 @5xl:row-start-1">
            <GoalsSectionSkeleton kind={goalsTab} />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'settings') return <SettingsPageSkeleton />
  if (variant === 'budget' || variant === 'budget-categories') return <BudgetSkeleton categories={variant === 'budget-categories'} />
  if (variant === 'accounts') return <AccountsPageSkeleton />
  if (variant === 'investments') return <InvestmentPageSkeleton />
  if (variant === 'documents') return <VaultPageSkeleton />
  if (variant === 'forecast') return <ForecastPageSkeleton />

  return (
    <section data-testid="drafts-skeleton" className="max-w-5xl space-y-4 sm:space-y-5" aria-label="Loading draft transactions">
      <PageHeader title={<Skeleton className="h-7 w-36 sm:h-[34px]" />} description={<Skeleton className="h-5 w-64 max-w-full" />} />
      <div className={cn(panelClass, 'flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5 sm:px-5')}>
        <div className="mr-auto space-y-1"><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-28" /></div>
        <Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-3">
        <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-9"><Skeleton className="h-5 w-32" /><Skeleton className="h-9 w-28 rounded-full" /></div>
        {[1, 2, 3, 4].map(i => <DraftRowSkeleton key={i} />)}
      </div>
    </section>
  )
}
