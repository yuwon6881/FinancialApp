import { AccountsSkeleton } from '../../settings/accounts/AccountsSkeleton'
import { cn } from '../../../lib/utils'
import { PageHeader } from '../PageHeader'
import { panelClass } from '../panelStyles'
import { Skeleton } from '../Skeleton'

export function BudgetSkeleton({ categories = false }: { categories?: boolean }) {
  return (
    <div data-testid={categories ? 'budget-categories-skeleton' : 'budget-skeleton'} className="space-y-6">
      <PageHeader title={<Skeleton className="h-7 w-24 sm:h-[34px]" />} description={
        <div className="flex h-10 flex-col justify-around sm:h-5">
          <Skeleton className="h-3.5 w-96 max-w-full" />
          <Skeleton className="h-3.5 w-44 sm:hidden" />
        </div>
      } />
      <div className="flex h-[45px] items-center gap-5 border-b border-border/70 lg:h-[37px]">
        <Skeleton className="h-3.5 w-26" />
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className="@container">
        <div className={cn('grid items-start gap-6', categories ? '@5xl:grid-cols-2' : '@4xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]')}>
          <div className={panelClass}>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1"><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-40 max-w-full" /></div>
                <Skeleton className="h-11 w-24 shrink-0 rounded-full lg:h-9" />
              </div>
              <Skeleton className={categories ? 'h-11 w-full rounded-control' : 'h-3 w-full rounded-full'} />
            </div>
            <div className="divide-y divide-border/60 border-t border-border/60">
              {[1, 2, 3, 4].map(row => (
                <div key={row} className="flex min-h-[68px] items-center gap-3 px-4 sm:px-5">
                  <Skeleton className="size-8 shrink-0 rounded-control" />
                  <div className="min-w-0 flex-1 space-y-1.5"><Skeleton className="h-4 w-24 max-w-full" /><Skeleton className="h-3 w-36 max-w-full" /></div>
                  <Skeleton className="h-5 w-10 shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className={panelClass}>
            <div className="space-y-1 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <div className="divide-y divide-border/60">
              {[1, 2, 3, 4].map(row => (
                <div key={row} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-[1_1_8rem] space-y-1"><Skeleton className="h-4 w-24 max-w-full" /><Skeleton className="h-3 w-36 max-w-full" /></div>
                  <Skeleton className="ml-auto h-11 w-36 rounded-control lg:h-10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AccountsPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title={<Skeleton className="h-7 w-28 sm:h-8" />} description={<Skeleton className="h-5 w-full max-w-72" />} />
      <AccountsSkeleton />
    </div>
  )
}

export function SettingsPageSkeleton() {
  return (
    <div data-testid="settings-skeleton" className="space-y-6">
      <PageHeader title={<Skeleton className="h-7 w-28 sm:h-8" />} />
      <div className="grid gap-6 xl:grid-cols-[15rem_minmax(0,1fr)] xl:items-start xl:gap-8">
        <div className="flex h-[45px] gap-3 overflow-hidden border-b border-border/70 lg:h-[37px] xl:h-auto xl:flex-col xl:gap-1 xl:border-0">
          {[1, 2, 3].map(row => (
            <div key={row} className="flex shrink-0 items-center gap-3 px-2.5 xl:h-14 xl:px-3">
              <Skeleton className="hidden size-8 rounded-full xl:block" />
              <div className="space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="hidden h-3 w-32 xl:block" /></div>
            </div>
          ))}
        </div>
        <div className="grid min-w-0 items-start gap-6 min-[1280px]:grid-cols-2">
          <div className={cn(panelClass, 'space-y-3 p-4 sm:p-6')}>
            <Skeleton className="h-5 w-32" />
            {[1, 2, 3].map(row => (
              <div key={row} className="flex items-center justify-between gap-3 border-t border-border/60 py-2">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-8 w-12 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
          <div className={cn(panelClass, 'space-y-3 p-4 sm:p-6')}>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-11 w-full rounded-control" />
          </div>
        </div>
      </div>
    </div>
  )
}
