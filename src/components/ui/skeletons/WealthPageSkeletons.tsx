import { cn } from '../../../lib/utils'
import { PageHeader } from '../PageHeader'
import { panelClass } from '../panelStyles'
import { Skeleton } from '../Skeleton'

export function InvestmentPageSkeleton() {
  return (
    <div data-testid="investments-skeleton" className="@container min-w-0 space-y-6">
      <PageHeader title={<Skeleton className="h-7 w-44 sm:h-[34px] sm:w-64" />} titleActions={<Skeleton className="h-11 w-28 rounded-full sm:w-40 lg:h-9" />} />
      <div className={cn(panelClass, '@container overflow-hidden')}>
        <div className="p-5 sm:p-6">
          <Skeleton className="h-11 w-28 sm:h-7" />
          <Skeleton className="mt-1 h-[34px] w-44 @xs:h-11" />
          <div className="mt-3 flex gap-8">
            {[1, 2].map(item => (
              <div key={item} className="space-y-0.5"><Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-24" /></div>
            ))}
          </div>
          <div className="mt-4 grid gap-x-6 gap-y-1.5 border-y border-border/60 py-2.5 @lg:grid-cols-[minmax(9rem,auto)_minmax(0,1fr)_auto]">
            <Skeleton className="h-[18px] w-36" /><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-32" />
          </div>
          <div className="mt-5 grid divide-y divide-foreground/10 rounded-control inset-group px-3.5 @md:grid-cols-3 @md:divide-x @md:divide-y-0 @md:px-0 @md:py-3">
            {[1, 2, 3].map(item => (
              <div key={item} className="flex min-h-10 items-center justify-between gap-3 @md:block @md:min-h-0 @md:space-y-2 @md:px-4">
                <Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border/60 px-5 py-4 sm:px-6 lg:hidden"><Skeleton className="h-3 w-28" /></div>
        <div className="hidden grid-cols-2 gap-10 border-t border-border/60 px-6 py-5 lg:grid">
          {[1, 2].map(group => (
            <div key={group}>
              <Skeleton className="h-6 w-28" />
              {[1, 2, 3].map(item => (
                <div key={item} className="flex min-h-10 items-center justify-between border-b border-border/50 last:border-0">
                  <Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 px-5 py-4 sm:justify-start sm:px-6">
          {[1, 2, 3, 4, 5].map(item => (
            <Skeleton key={item} className={cn('h-11 w-25 rounded-full lg:h-9', item === 5 && 'sm:ml-auto')} />
          ))}
        </div>
      </div>
      <div className="flex h-[45px] items-center gap-6 border-b border-border/70 lg:h-[37px]">
        {[1, 2, 3].map(item => <Skeleton key={item} className="h-4 w-16" />)}
      </div>
      <div className={cn(panelClass, 'flex items-center justify-between p-4 sm:p-5')}>
        <Skeleton className="h-5 w-32" /><Skeleton className="size-4" />
      </div>
    </div>
  )
}

export function VaultBodySkeleton() {
  return (
    <>
      <div className={cn(panelClass, '@container p-4 sm:p-5')}>
        <div className="flex items-center justify-between gap-3"><Skeleton className="h-5 w-36" /><Skeleton className="h-9 w-24 rounded-full" /></div>
        <Skeleton className="mt-0.5 h-4 w-40" />
        <div className="mt-3 divide-y divide-border/60">
          {[1, 2, 3].map(item => (
            <div key={item} className="grid min-h-[62px] grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-x-3 py-2.5 @2xl:min-h-14 @2xl:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_5rem_6.5rem] @2xl:gap-x-5">
              <Skeleton className="h-4 w-28 max-w-full" />
              <Skeleton className="col-start-1 row-start-2 h-1.5 w-full rounded-full @2xl:col-start-2 @2xl:row-start-1" />
              <Skeleton className="hidden h-4 w-full @2xl:block" />
              <Skeleton className="col-start-2 row-span-2 row-start-1 h-8 w-20 rounded-full @2xl:col-start-4 @2xl:row-span-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="@container space-y-3">
        <div className="flex items-center gap-2"><Skeleton className="h-6 w-32" /><Skeleton className="h-5 w-12 rounded-full" /></div>
        <div className="flex flex-col gap-2 @2xl:flex-row @2xl:justify-between">
          {[1, 2].map(group => (
            <div key={group} className="flex gap-2">
              <Skeleton className="h-11 w-20 rounded-full lg:h-9" /><Skeleton className="h-11 w-24 rounded-full lg:h-9" />
            </div>
          ))}
        </div>
        <div className={cn(panelClass, 'divide-y divide-border/60')}>
          {[1, 2, 3].map(item => (
            <div key={item} className="flex min-h-20 items-center gap-3 px-4">
              <Skeleton className="size-9 shrink-0 rounded-control" />
              <div className="min-w-0 flex-1 space-y-1.5"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-28 max-w-full" /></div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function VaultPageSkeleton() {
  return (
    <div data-testid="documents-skeleton" className="space-y-5">
      <div className="pt-1">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-18 sm:h-[34px]" />
          <div className="flex gap-2"><Skeleton className="size-11 rounded-full sm:w-32 lg:h-9" /><Skeleton className="h-11 w-25 rounded-full lg:h-9" /></div>
        </div>
        <Skeleton className="mt-1 hidden h-5 w-80 max-w-full sm:block" />
        <Skeleton className="mt-1.5 h-4 w-56 max-w-full sm:mt-2" />
      </div>
      <VaultBodySkeleton />
    </div>
  )
}
