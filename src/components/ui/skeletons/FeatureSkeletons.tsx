import React from 'react'
import { Card } from '../Card'
import { Skeleton } from '../Skeleton'
import { cn } from '../../../lib/utils'
import { panelClass, panelFromMediumClass } from '../panelStyles'

export const CardSkeleton: React.FC = () => (
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

export const PlainHeaderSkeleton: React.FC<{ backButton?: boolean }> = ({ backButton = false }) => (
  <div className="flex items-start gap-3">
    {backButton && <Skeleton className="size-9 shrink-0 rounded-xl" />}
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3 w-72 max-w-full" />
    </div>
  </div>
)

export const SettingsHeaderSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
    <div className="flex items-center gap-2"><Skeleton className="size-5 rounded-md" /><Skeleton className="h-6 w-28" /></div>
    <Skeleton className="h-3 w-80 max-w-full" />
  </div>
)

/** Insights' page header: the title and its Explain action on the canvas, the cycle under it. */
export const ReportsHeaderSkeleton: React.FC = () => (
  <div className="space-y-2.5 pt-1">
    <div className="flex items-center gap-2.5"><Skeleton className="h-7 w-28 sm:h-8" /><Skeleton className="size-11 rounded-full sm:h-8 sm:w-36" /></div>
    <Skeleton className="h-4 w-48 max-w-full" />
  </div>
)

export const WishlistHeaderSkeleton: React.FC = () => (
  <div data-testid="wishlist-header-skeleton" className={`${panelClass} flex items-center justify-between gap-3 p-4 sm:p-5`}>
    <div className="min-w-0 space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="hidden h-3 w-72 max-w-full sm:block" />
    </div>
    <Skeleton className="h-9 w-32 shrink-0 rounded-xl" />
  </div>
)

export const RewardsPoolSkeleton: React.FC = () => (
  <Card data-testid="wishlist-pool-skeleton" className="space-y-3 p-3 sm:space-y-4 sm:p-5">
    <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
      <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-32" /></div>
      <div className="flex items-center justify-end gap-2"><Skeleton className="h-8 w-32 rounded-xl" /><Skeleton className="size-8 rounded-lg" /></div>
    </div>
    <Skeleton className="h-2.5 w-full rounded-full" />
    {/* One status line and one collapsed summary row. The legend tiles and the cycle meter moved
        into the detail tail, so reserving their height here would shift the layout on hydrate. */}
    <Skeleton className="h-3 w-56 max-w-full" />
    <Skeleton className="h-9 w-full rounded-lg" />
  </Card>
)

export const RecurringHeaderSkeleton: React.FC = () => (
  <Card className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
    <div className="min-w-0 w-full md:flex-1">
      <Skeleton className="h-6 w-72 max-w-full" />
      <Skeleton className="mt-1 h-3 w-48" />
      <div className="mt-4 grid min-w-0 grid-cols-2 gap-y-3 sm:grid-cols-3 sm:gap-y-0">
        <div className="min-w-0 space-y-1.5 pr-2"><Skeleton className="h-2.5 w-16 max-w-full" /><Skeleton className="h-7 w-20 max-w-full" /></div>
        <div className="min-w-0 space-y-1.5 border-l border-border/60 pl-2 sm:px-2"><Skeleton className="h-2.5 w-16 max-w-full" /><Skeleton className="h-7 w-20 max-w-full" /></div>
        <div className="col-span-2 min-w-0 space-y-1.5 border-t border-border/60 pt-2 sm:col-span-1 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"><Skeleton className="h-2.5 w-16 max-w-full" /><Skeleton className="h-7 w-12 max-w-full" /></div>
      </div>
    </div>
    <Skeleton className="h-11 w-44 rounded-xl" />
  </Card>
)

export const BillDayStripSkeleton: React.FC = () => (
  <div className={cn(panelClass, 'space-y-3 p-4 sm:p-5')}>
    <div className="flex items-center justify-between gap-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-28" /></div>
    <div className="flex gap-1 overflow-hidden">
      {Array.from({ length: 14 }, (_, i) => <Skeleton key={i} className="size-10 shrink-0 rounded-full" />)}
    </div>
  </div>
)

/** The Insights buckets: list rows on a phone, two or four columns from a medium container. */
export const ReportBucketsSkeleton: React.FC = () => (
  <div className="@container space-y-3">
    <div className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-3.5 w-72 max-w-full" /></div>
    <div className={cn(panelClass, 'grid gap-px overflow-hidden bg-border/60 p-0 @xl:grid-cols-2 @4xl:grid-cols-4')}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="space-y-3 bg-card px-4 py-3.5 @xl:px-5 @xl:py-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-[0.625rem]" />
            <div className="min-w-0 flex-1 space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-20" /></div>
            <Skeleton className="h-5 w-24 @xl:hidden" />
          </div>
          <Skeleton className="hidden h-7 w-32 @xl:block" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="hidden space-y-2 border-t border-border/60 pt-3 @xl:block">
            {[1, 2, 3, 4].map(row => <div key={row} className="flex justify-between gap-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div>)}
          </div>
        </div>
      ))}
    </div>
  </div>
)

/** Commitments as a list of progress rows; rewards as a grid of tiles. */
export const GoalsSectionSkeleton: React.FC<{ kind: 'commitments' | 'rewards'; items?: number }> = ({ kind, items = 3 }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-2.5 w-64 max-w-full" /></div>
      <Skeleton className="h-9 w-24 rounded-full" />
    </div>
    {kind === 'commitments' ? (
      <div className={cn(panelClass, 'divide-y divide-border/60 p-0')}>
        {Array.from({ length: items }, (_, i) => (
          <div key={i} className="flex items-start gap-3.5 px-4 py-4 sm:px-5">
            <Skeleton className="size-[3.25rem] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /><Skeleton className="h-9 w-40 rounded-full" /></div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: items }, (_, i) => (
          <div key={i} className="space-y-3 rounded-panel border border-border/60 bg-card p-4">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-28 max-w-full" />
            <Skeleton className="h-6 w-24 max-w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
        ))}
      </div>
    )}
  </section>
)

const LoanCardSkeleton: React.FC = () => (
  <div className="space-y-3 rounded-2xl border border-border/60 bg-card/85 p-4 shadow-sm sm:p-5">
    <div className="space-y-1.5"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-32" /></div>
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3 w-56 max-w-full" />
      <Skeleton className="h-3 w-44" />
    </div>
    <Skeleton className="h-11 w-full rounded-xl" />
    <Skeleton className="h-11 w-full rounded-xl" />
    <div className="flex items-center justify-between gap-2 border-t border-border/30 pt-4">
      <Skeleton className="h-9 w-32 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
  </div>
)

export const LoansSectionSkeleton: React.FC<{ cards?: number }> = ({ cards = 3 }) => (
  <section className={cn(panelFromMediumClass, 'space-y-4')}>
    <Skeleton className="h-4 w-32" />
    <div className="space-y-3">
      {Array.from({ length: cards }, (_, index) => <LoanCardSkeleton key={index} />)}
    </div>
  </section>
)

export const InvestmentSummarySkeleton: React.FC = () => (
  <div className={`${panelClass} flex flex-col p-4`}>
    <div className="flex items-center justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="size-8 rounded-lg" /></div>
    <Skeleton className="mt-3 h-6 w-32" />
    <div className="mt-3 space-y-2 border-t border-border/40 pt-1"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
  </div>
)

/** The cycle calendar beside its weekly pacing rows, which drop under it below a wide container. */
export const CycleCalendarSkeleton: React.FC = () => (
  <div className="@container space-y-3">
    <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3.5 w-48" /></div>
    <div className={cn(panelClass, 'grid gap-5 p-3 sm:p-5 @4xl:grid-cols-[minmax(0,1fr)_16rem] @4xl:gap-0')}>
      <div className="min-w-0 space-y-3 @4xl:pr-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-11 w-48 rounded-full lg:h-9" /><Skeleton className="h-3 w-44" /></div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: 7 }).map((_, index) => <Skeleton key={`weekday-${index}`} className="mx-auto h-3 w-3 sm:w-7" />)}
          {Array.from({ length: 35 }).map((_, index) => <Skeleton key={`day-${index}`} className="h-11 w-full rounded-lg sm:h-14 sm:rounded-xl md:h-16" />)}
        </div>
      </div>
      <div className="space-y-3 border-t border-border/60 pt-4 @4xl:border-l @4xl:border-t-0 @4xl:pl-6 @4xl:pt-0">
        <div className="flex justify-between"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-12" /></div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={`week-${index}`} className="flex items-center justify-between gap-3 py-1">
            <div className="space-y-1.5"><Skeleton className="h-4 w-16" /><Skeleton className="h-3 w-24" /></div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  </div>
)
