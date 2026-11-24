import { Skeleton } from '../Skeleton'
import { panelClass } from '../panelStyles'
import { cn } from '../../../lib/utils'

export function InvestmentPlanSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading investment plan" className="grid w-full min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <div className={cn(panelClass, 'min-w-0 space-y-5 p-4 sm:p-6')} aria-hidden="true">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-3 w-48 max-w-full" /></div>
          <Skeleton className="h-11 w-24 shrink-0 rounded-full lg:h-9" />
        </div>
        <Skeleton className="h-11 w-44 max-w-full lg:h-9" />
        <Skeleton className="h-2 w-full" />
        {[1, 2, 3].map(row => <div key={row} className="space-y-3 border-b border-border/60 pb-5"><Skeleton className="h-4 w-24" /><Skeleton className="h-2 w-full" /></div>)}
        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-full" /></div>
        {[1, 2].map(row => <div key={row} className="space-y-3 pb-4"><Skeleton className="h-4 w-44" /><Skeleton className="h-2 w-full" /><Skeleton className="h-3 w-full" /></div>)}
      </div>
      <div className={cn(panelClass, 'min-w-0 space-y-3 p-4 sm:p-6')} aria-hidden="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-11 w-44 max-w-full lg:h-9" />
        <Skeleton className="h-3 w-56 max-w-full" />
        {[1, 2, 3].map(row => <div key={row} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-44 max-w-full rounded-control" /></div>)}
        <Skeleton className="h-5 w-32" />
        <Skeleton className="ml-auto h-11 w-24 rounded-full" />
      </div>
      <Skeleton className="ml-auto h-12 w-44 rounded-full xl:col-span-2 lg:h-10" />
    </div>
  )
}
