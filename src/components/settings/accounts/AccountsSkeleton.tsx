import { Skeleton } from '../../ui/Skeleton'

/** Mirrors the account panel's header, search bar, four bucket group cards, and note while it loads. */
export function AccountsSkeleton() {
  return (
    <div data-testid="accounts-skeleton" className="app-panel space-y-6 rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-5">
      {/* Panel header */}
      <div className="flex flex-col gap-3 border-b border-border/40 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-2xl" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-28 rounded-full" />
            </div>
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>

      {/* Search filter input skeleton */}
      <Skeleton className="h-10 w-64 max-w-full rounded-xl" />

      {/* Four bucket cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map(index => (
          <div key={index} className="space-y-4 rounded-2xl border border-border/60 bg-background/40 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>

            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-32" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>

            <div className="flex items-center gap-2 border-t border-border/30 pt-3">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-44 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer info skeleton */}
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}
