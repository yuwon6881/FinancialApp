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

const CardSkeleton: React.FC = () => (
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
const CycleHeaderSkeleton: React.FC<{
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
  <div className="app-panel rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-3 w-72 max-w-full" /></div></div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:flex-nowrap lg:w-auto"><Skeleton className="h-9 flex-1 min-w-[9.5rem] rounded-xl sm:w-52 sm:flex-initial" /><Skeleton className="h-9 w-20 shrink-0 rounded-xl sm:w-24" /><Skeleton className="h-9 w-24 shrink-0 rounded-lg" /></div>
    </div>
  </div>
)

const DashboardHeaderSkeleton: React.FC = () => (
  <div className="app-panel overflow-hidden rounded-2xl border border-border/60 bg-card/92">
    <div className="grid gap-5 rounded-2xl bg-linear-to-br from-blue-500/10 via-transparent to-teal-500/10 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,25rem)] lg:items-center">
      <div className="flex items-center gap-3"><Skeleton className="size-11 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-32" /><Skeleton className="h-3 w-48" /></div></div>
      <div className="space-y-3 rounded-2xl border border-border/60 bg-background/65 p-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-7 w-36" /><Skeleton className="h-3 w-40" /></div>
    </div>
  </div>
)

const RewardsPoolSkeleton: React.FC = () => (
  <Card data-testid="wishlist-pool-skeleton" className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-32" /></div>
      <div className="flex flex-wrap justify-end gap-2"><Skeleton className="h-8 w-20 rounded-xl" /><Skeleton className="h-8 w-32 rounded-xl" /></div>
    </div>
    <Skeleton className="h-2.5 w-full rounded-full" />
    <div className="flex flex-wrap gap-x-5 gap-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-32" /></div>
    <div className="space-y-2 rounded-xl border border-border/50 bg-muted/25 p-3">
      <div className="flex justify-between gap-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-36" /></div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3 w-64 max-w-full" />
    </div>
  </Card>
)

const HorizontalRailSkeleton: React.FC<{ kind: 'commitments' | 'rewards'; cards?: number }> = ({ kind, cards = 3 }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="space-y-1.5"><Skeleton className="h-4 w-28" />{kind === 'rewards' && <Skeleton className="h-2.5 w-48" />}</div>
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
    <div className="group/horizontal-rail relative min-w-0">
      <div className="horizontal-rail no-scrollbar flex w-full min-w-0 gap-3 overflow-hidden pb-1">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="snap-start flex w-[80vw] sm:w-[22rem] shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-2.5 w-28" /></div>
          <div className="space-y-2"><div className="flex justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-3 w-20" /></div><Skeleton className="h-1.5 w-full rounded-full" /></div>
          {kind === 'commitments' ? (
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/25 p-2.5"><div className="flex justify-between"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-2.5 w-24" /></div><Skeleton className="h-1 w-full rounded-full" /><Skeleton className="h-3 w-36" /></div>
          ) : <Skeleton className="h-3 w-36" />}
          <div className="mt-auto flex items-center gap-1 border-t border-border/30 pt-3"><Skeleton className="h-8 w-20 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="ml-auto h-8 w-16 rounded-lg" /><Skeleton className="h-8 w-20 rounded-lg" /></div>
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
  <div className="app-panel space-y-4 rounded-2xl border border-border/60 bg-card/92 p-5">
    <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-56 max-w-full" /></div>
    <CompactMetricGridSkeleton count={3} className="lg:grid-cols-3" />
  </div>
)

const FinancialPlanSkeleton: React.FC = () => (
  <div className="app-panel space-y-4 rounded-2xl border border-border/60 bg-card/92 p-6">
    <div className="space-y-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-80 max-w-full" /></div>
    <div className="flex gap-4"><Skeleton className="h-2 w-24" /><Skeleton className="h-2 w-32" /></div>
    <CompactMetricGridSkeleton count={3} className="gap-6 xl:grid-cols-3" />
  </div>
)

const InvestmentSummarySkeleton: React.FC = () => (
  <div className="app-panel flex flex-col rounded-2xl border border-border/60 bg-card/92 p-4">
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

/**
 * Layout-specific skeletons shared by initial loading, lazy page transitions,
 * and cycle refreshes. Keeping them here prevents placeholders from drifting
 * away from the current page structures.
 */
export type PageSkeletonVariant = 'dashboard' | 'reports' | 'ledger' | 'recurring' | 'wishlist' | 'drafts' | 'settings' | 'investments' | 'documents'

const PanelSkeleton = ({ height = 'h-40' }: { height?: string }) => (
  <div className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
    <Skeleton className="h-4 w-40" />
    <Skeleton className={cn('mt-5 w-full rounded-xl', height)} />
  </div>
)

export const CycleSkeleton: React.FC<{ variant: PageSkeletonVariant; fullPage?: boolean }> = ({ variant, fullPage = false }) => {
  if (variant === 'dashboard') {
    return (
      <div data-testid="dashboard-skeleton" className="space-y-6">
        <DashboardHeaderSkeleton />
        <div className="app-panel flex items-center gap-3 rounded-2xl border border-border/60 bg-card/92 p-5"><Skeleton className="size-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-2/3" /></div><Skeleton className="hidden h-9 w-28 rounded-xl sm:block" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="app-panel space-y-5 rounded-2xl border border-border/60 bg-card/92 p-5">
          <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-72 max-w-full" /></div>
          <CompactMetricGridSkeleton count={6} />
          <div className="flex justify-end"><Skeleton className="h-8 w-32 rounded-lg" /></div>
        </div>
        <CategoryWatchSkeleton />
      </div>
    )
  }

  if (variant === 'reports') {
    return (
      <div data-testid="reports-skeleton" className="space-y-6">
        <ReportsHeaderSkeleton />
        <div className="app-panel space-y-4 rounded-2xl border border-border/60 bg-card/92 p-5"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-full rounded-xl" /><Skeleton className="h-10 w-full rounded-xl" /></div>
        <FinancialPlanSkeleton />
        <div className="app-panel flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/92 p-5"><div className="flex items-center gap-3"><Skeleton className="size-11 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-64 max-w-full" /></div></div><Skeleton className="h-6 w-28" /></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,2fr)]">
          <PanelSkeleton height="h-56" />
          <CategoryWatchSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PanelSkeleton height="h-56" />
          <PanelSkeleton height="h-56" />
        </div>
        <PanelSkeleton height="h-72" />
      </div>
    )
  }

  if (variant === 'ledger') {
    return (
      <div data-testid="ledger-skeleton" className="space-y-6 w-full min-w-0 overflow-hidden">
        <CycleHeaderSkeleton titleWidth="w-44" subtitleWidth="w-64" controlWidth="w-52" />
        <div className="flex flex-col gap-3 sm:flex-row min-w-0">
          <Skeleton className="h-10 flex-1 rounded-xl min-w-0" />
          <Skeleton className="h-10 w-full rounded-xl sm:w-48 shrink-0" />
        </div>
        <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/60 space-y-3 min-w-0 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => <ListRowSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (variant === 'recurring') {
    return (
      <div data-testid="recurring-skeleton" className="space-y-6">
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
      <div data-testid="wishlist-skeleton" className="space-y-5">
        <RewardsPoolSkeleton />
        {fullPage && (
          <>
            <HorizontalRailSkeleton kind="commitments" />
            <HorizontalRailSkeleton kind="rewards" />
          </>
        )}
      </div>
    )
  }

  if (variant === 'settings') {
    return (
      <div data-testid="settings-skeleton" className="space-y-6">
        <SettingsHeaderSkeleton />
        <div className="flex gap-6 border-b border-border/30 pb-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div className="app-panel space-y-5 rounded-2xl border border-border/60 bg-card/92 p-5 lg:col-span-2">
            <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-64" /></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            <CompactMetricGridSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-2" />
          </div>
          <div className="app-panel space-y-4 rounded-2xl border border-border/60 bg-card/92 p-5">
            <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-full" /></div>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
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
        <div className="app-panel space-y-5 rounded-2xl border border-border/60 bg-card/92 p-5"><div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-72 max-w-full" /></div><CompactMetricGridSkeleton count={3} /></div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <PanelSkeleton height="h-64" />
          <PanelSkeleton height="h-64" />
        </div>
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
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl sm:w-40" />
        </div>
        <div className="app-panel space-y-4 rounded-2xl border border-border/60 bg-card/92 p-3 sm:p-5">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="app-panel space-y-4 rounded-2xl border border-border/60 bg-card/92 p-3 sm:p-5">
          <div className="flex items-center justify-between gap-3">
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
    <div data-testid="drafts-skeleton" className="space-y-6">
      {/* Matches DraftStagingView's simple back-button + "Queue" header row,
          not the card-style CycleHeaderSkeleton used by the other tabs. */}
      <div className="flex items-center gap-3 border-b border-border/40 pb-4">
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <ListRowSkeleton key={i} />)}
      </div>
    </div>
  )
}
