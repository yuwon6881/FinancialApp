import { Skeleton } from '../../ui/Skeleton'
import { cn } from '../../../lib/utils'
import { panelClass } from '../../ui/panelStyles'

/** Total, filter, and bucket groups in the same order as the Accounts page. */
export function AccountsSkeleton() {
  return (
    <div data-testid="accounts-skeleton" className="space-y-6">
      <div className={cn(panelClass, 'p-5 sm:p-6')}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="space-y-1"><Skeleton className="h-[18px] w-36" /><Skeleton className="h-11 w-44" /></div>
          <Skeleton className="h-[18px] w-24" />
        </div>
        <Skeleton className="mt-5 h-2 w-full rounded-full" />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {[1, 2, 3, 4].map(bucket => <Skeleton key={bucket} className="h-[18px] w-26" />)}
        </div>
      </div>

      {/* Search filter input skeleton */}
      <Skeleton className="h-11 w-full max-w-sm rounded-full lg:h-10" />

      {/* Four bucket cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map(index => (
          <div key={index} className="space-y-4 rounded-2xl border border-border/60 bg-background/40 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
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
                <div key={rowIdx} className="space-y-2.5 rounded-control bg-inset p-3">
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
                  {rowIdx === 2 && index === 1 && (
                    <div className="flex justify-between gap-3 px-3 py-2">
                      {[1, 2].map(column => <div key={column} className="space-y-1.5"><Skeleton className="h-3 w-20" /><Skeleton className="h-3.5 w-24" /></div>)}
                    </div>
                  )}
                  <div className="border-t border-border/30 pt-2">
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-44 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
