import { Skeleton } from '../../ui/Skeleton'

/** Mirrors the account panel's header, four bucket cards, notice, and row list while it loads. */
export function AccountsSkeleton() {
  return (
    <div data-testid="accounts-skeleton" className="app-panel space-y-6 rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-border/40 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-2xl" />
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-28 rounded-full" /></div>
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(index => (
          <div key={index} className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3 sm:p-3.5">
            <div className="flex items-center justify-between gap-2"><Skeleton className="h-5 w-20 rounded-md" /><Skeleton className="h-3 w-10" /></div>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-3">
        <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-56" /></div>
        {[1, 2, 3, 4].map(index => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}
      </div>
    </div>
  )
}
