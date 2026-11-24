import { Skeleton } from '../Skeleton'
import { panelClass } from '../panelStyles'
import { cn } from '../../../lib/utils'

/** Mirrors the plan tab: groups and targets on the left, classification spanning both rows on the right. */
function PanelHeader({ title }: { title: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2"><Skeleton className={cn('h-5', title)} /><Skeleton className="h-3 w-56 max-w-full" /></div>
      <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
    </div>
  )
}

export function InvestmentPlanSettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading investment plan" className="grid w-full min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <div className={cn(panelClass, 'min-w-0 space-y-4 p-4 sm:p-6')} aria-hidden="true">
        <PanelHeader title="w-36" />
        {[1, 2, 3].map(row => <div key={row} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-40 max-w-full rounded-control" /></div>)}
        <Skeleton className="ml-auto h-11 w-28 rounded-full lg:h-9" />
      </div>
      <div className={cn(panelClass, 'min-w-0 space-y-3 p-4 sm:p-6 xl:col-start-2 xl:row-span-2 xl:row-start-1')} aria-hidden="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
        {[1, 2, 3].map(row => <div key={row} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-44 max-w-full rounded-control" /></div>)}
      </div>
      <div className={cn(panelClass, 'min-w-0 space-y-5 p-4 sm:p-6')} aria-hidden="true">
        <PanelHeader title="w-32" />
        <Skeleton className="h-2 w-full" />
        {[1, 2, 3].map(row => <div key={row} className="space-y-3 border-b border-border/60 pb-5"><Skeleton className="h-4 w-24" /><Skeleton className="h-2 w-full" /></div>)}
        {[1, 2].map(row => <div key={row} className="space-y-3 pb-4"><Skeleton className="h-4 w-44" /><Skeleton className="h-2 w-full" /><Skeleton className="h-3 w-full" /></div>)}
      </div>
      <div className="flex justify-end gap-3 xl:col-span-2" aria-hidden="true">
        <Skeleton className="h-11 w-36 rounded-full lg:h-9" />
        <Skeleton className="h-11 w-44 rounded-full lg:h-9" />
      </div>
    </div>
  )
}
