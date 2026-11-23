import { Skeleton } from '../Skeleton'
import { panelClass } from '../panelStyles'
import { cn } from '../../../lib/utils'

/** The cycle cards alone, for the view's own loading state once the page shell is drawn. */
export function ForecastCyclesSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-3 lg:grid-cols-2">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className={cn(panelClass, 'space-y-3 p-4')}>
          <div className="space-y-1"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-40" /></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[0, 1, 2, 3].map(bucket => (
              <div key={bucket} className="space-y-1"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-5 w-28" /></div>
            ))}
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      ))}
    </div>
  )
}

/** Matches ForecastView: header, scenario note, scenario panel, then the cycle cards. */
export function ForecastPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8" aria-label="Loading forecast">
      <div className="space-y-2"><Skeleton className="h-7 w-32 sm:h-[34px]" /><Skeleton className="h-5 w-80 max-w-full" /></div>
      <Skeleton className="h-9 w-full rounded-control" />
      <div className={cn(panelClass, 'space-y-4 p-4 sm:p-5')}>
        <Skeleton className="h-6 w-36" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(index => <Skeleton key={index} className="h-11 w-full rounded-control" />)}
        </div>
        <Skeleton className="h-28 w-full rounded-control" />
      </div>
      <ForecastCyclesSkeleton />
    </div>
  )
}
