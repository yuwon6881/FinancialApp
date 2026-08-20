import { Skeleton } from '../../ui/Skeleton'

/** Mirrors the account panel's header, search bar, four bucket group cards, and note while it loads. */
export function AccountsSkeleton({ isCurrentCycle = true }: { isCurrentCycle?: boolean }) {
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

      {!isCurrentCycle && <Skeleton className="h-16 w-full rounded-xl" />}

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
              {[1, 2].map(rowIdx => (
                <div key={rowIdx} className="space-y-2.5 rounded-xl border border-border/60 bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-9 rounded-xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="border-t border-border/30 pt-2">
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
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
