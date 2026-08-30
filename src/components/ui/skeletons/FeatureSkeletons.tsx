import React from 'react'
import { Card } from '../Card'
import { Skeleton } from '../Skeleton'
import { panelClass } from '../Panel'

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

export const ReportsHeaderSkeleton: React.FC = () => (
  <div className={`${panelClass} p-4 sm:p-6`}>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-3 w-72 max-w-full" /></div></div>
      <div data-testid="reports-skeleton-controls" className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2 lg:w-auto"><Skeleton className="h-11 w-0 min-w-0 flex-1 rounded-xl sm:h-10 sm:w-52 sm:flex-initial" /><Skeleton className="h-11 w-28 shrink-0 rounded-xl sm:h-10" /><Skeleton className="size-11 shrink-0 rounded-lg sm:h-10 sm:w-24" /><Skeleton className="size-11 shrink-0 rounded-lg sm:h-10 sm:w-40" /></div>
    </div>
  </div>
)

export const DashboardHeaderSkeleton: React.FC = () => (
  <div className={`${panelClass} overflow-hidden`}>
    <div className="grid gap-5 rounded-2xl bg-linear-to-br from-blue-500/10 via-transparent to-teal-500/10 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,25rem)] lg:items-center">
      <div className="flex items-center gap-3"><Skeleton className="size-11 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-32" /><Skeleton className="h-3 w-48" /></div></div>
      <div className="min-w-0 w-full space-y-3 rounded-2xl border border-border/60 bg-background/65 p-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-36" /><Skeleton className="h-3 w-40" /></div>
    </div>
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

export const BillTimelineSkeleton: React.FC = () => (
  <Card className="space-y-6">
    <div className="flex items-center justify-between gap-3 border-b border-border/30 pb-3">
      <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-3 w-72 max-w-full" /></div>
      <Skeleton className="size-8 rounded-lg" />
    </div>
    <Skeleton className="h-72 w-full rounded-2xl sm:h-[26rem]" />
  </Card>
)

export const CarryoverLedgerSkeleton: React.FC = () => (
  <div className={`${panelClass} space-y-4 p-6`}>
    <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-3 w-80 max-w-full" /></div>
    <div className="hidden overflow-x-hidden min-[1280px]:block">
      <div className="grid grid-cols-6 gap-4 border-b border-border/50 px-4 pb-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-28" /></div>
      <div className="space-y-1.5 pt-2">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="grid grid-cols-6 items-center gap-4 rounded-xl px-4 py-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-14" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-24 justify-self-end rounded-lg" /></div>)}</div>
    </div>
    <div className="grid grid-cols-1 gap-4 min-[1280px]:hidden">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="space-y-3 rounded-xl border border-border bg-background/50 p-4"><div className="flex justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16 rounded-md" /></div><div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-3"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-24" /></div><div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" /></div></div>)}</div>
  </div>
)

export const HorizontalRailSkeleton: React.FC<{ kind: 'commitments' | 'rewards'; cards?: number }> = ({ kind, cards = 3 }) => (
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
          {/* One status line plus a collapsed detail summary, for both card kinds. */}
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="mt-auto flex items-center gap-1.5 border-t border-border/30 pt-3">
            {kind === 'commitments'
              ? <><Skeleton className="size-8 rounded-lg" /><Skeleton className="h-8 w-16 rounded-lg" /></>
              : <Skeleton className="h-8 w-20 rounded-lg" />}
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

export const LoanCardSkeleton: React.FC = () => (
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
  <section className={`${panelClass} space-y-4 rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-border/60 sm:bg-card/92 sm:p-5`}>
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

export const CycleCalendarSkeleton: React.FC = () => (
  <div className={`${panelClass} p-3 sm:p-6`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2"><Skeleton className="h-5 w-28" /><Skeleton className="size-7 rounded-full" /></div>
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex gap-1 self-stretch rounded-xl border border-border/60 bg-muted/25 p-1 sm:self-start">
        <Skeleton className="h-7 flex-1 rounded-md sm:h-6 sm:w-16 sm:flex-none" />
        <Skeleton className="h-7 flex-1 rounded-md sm:h-6 sm:w-16 sm:flex-none" />
        <Skeleton className="h-7 flex-1 rounded-md sm:h-6 sm:w-16 sm:flex-none" />
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
      <div className="hidden items-center gap-1.5 sm:flex"><Skeleton className="h-3 w-16" />{[1, 2, 3, 4].map(level => <Skeleton key={level} className="size-3 rounded-sm" />)}<Skeleton className="h-3 w-20" /></div>
      <div className="hidden items-center gap-2.5 lg:flex"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div>
      <div className="flex items-center gap-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-20" /></div>
    </div>
    <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
      {Array.from({ length: 7 }).map((_, index) => <Skeleton key={`weekday-${index}`} className="mx-auto h-3 w-3 sm:w-7" />)}
      {Array.from({ length: 35 }).map((_, index) => <Skeleton key={`day-${index}`} className="h-11 w-full rounded-lg sm:h-14 sm:rounded-xl md:h-16" />)}
    </div>
    <div className="mt-4 border-t border-border/50 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 min-[1280px]:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={`week-${index}`} className="space-y-2 rounded-xl border border-border/50 bg-muted/15 p-2 sm:p-2.5">
            <div className="flex justify-between"><Skeleton className="h-3 w-12" /><Skeleton className="hidden h-2.5 w-16 min-[1280px]:block" /></div>
            <div className="flex justify-between"><Skeleton className="h-3 w-14" /><Skeleton className="h-2.5 w-8" /></div>
          </div>
        ))}
      </div>
    </div>
  </div>
)
