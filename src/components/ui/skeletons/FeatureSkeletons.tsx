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

/** Insights' page header: the title and its Explain action on the canvas, the cycle under it. */
export const ReportsHeaderSkeleton: React.FC = () => (
  <div className="space-y-2.5 pt-1">
    <div className="flex items-center gap-2.5"><Skeleton className="h-7 w-28 sm:h-8" /><Skeleton className="size-11 rounded-full sm:h-8 sm:w-36" /></div>
    <Skeleton className="h-4 w-48 max-w-full" />
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

export const RecurringHeaderSkeleton = ({ loans = false }: { loans?: boolean }) => (
  <div className="pt-1">
    <div className="flex items-center justify-between gap-3 sm:max-lg:flex-col sm:max-lg:items-start sm:max-lg:gap-4">
      <Skeleton className={cn('h-7 min-w-0 sm:h-[34px]', loans ? 'w-24' : 'w-48')} />
      <Skeleton className="h-11 w-25 shrink-0 rounded-full lg:h-9" />
    </div>
    <div className={cn(panelClass, 'mt-5 grid grid-cols-2 gap-4 px-4 py-4 sm:px-5 lg:gap-y-0', loans ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
      {Array.from({ length: loans ? 3 : 4 }, (_, i) => (
        <div key={i} className={cn('space-y-1', i > 0 && 'lg:border-l lg:border-border/70 lg:pl-2', i === 2 && loans && 'col-span-2 border-t border-border/70 pt-3 lg:col-span-1 lg:border-t-0 lg:pt-0', i % 2 === 1 && 'border-l border-border/70 pl-2')}>
          <Skeleton className="h-4 w-20 max-w-full" /><Skeleton className="h-6 w-24 max-w-full" />
        </div>
      ))}
    </div>
  </div>
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

export const LoanCardsSkeleton = () => (
  <div className="grid gap-4 2xl:grid-cols-2" role="status" aria-label="Loading loans">
    {[1, 2].map(index => <LoanCardSkeleton key={index} />)}
  </div>
)

export const LoansSectionSkeleton = () => (
  <section className={cn(panelFromMediumClass, 'space-y-4')}>
    <Skeleton className="h-4 w-32" />
    <LoanCardsSkeleton />
  </section>
)

/** The cycle calendar as week rows: dates and a total, with seven day bars under them on a narrow container. */
export const CycleCalendarSkeleton: React.FC = () => (
  <div className="@container space-y-3">
    <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3.5 w-48" /></div>
    <div className={cn(panelClass, 'space-y-3 p-3 sm:p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-11 w-48 rounded-full lg:h-9" /><Skeleton className="h-3 w-44" /></div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={`week-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 @xl:grid-cols-[8.5rem_minmax(0,1fr)_7.5rem] @xl:gap-x-5">
            <div className="space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-14" /></div>
            <div className="col-span-2 grid grid-cols-7 gap-1 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1">
              {Array.from({ length: 7 }).map((__, day) => <Skeleton key={`day-${day}`} className="h-14 w-full rounded-control" />)}
            </div>
            <Skeleton className="col-start-2 row-start-1 h-4 w-16 justify-self-end @xl:col-start-3" />
          </div>
        ))}
      </div>
    </div>
  </div>
)
