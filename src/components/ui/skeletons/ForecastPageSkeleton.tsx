import { PageContainer } from '../PageContainer'
import { Panel } from '../Panel'
import { Skeleton } from '../Skeleton'

export function ForecastCyclesSkeleton() {
  return (
    <div aria-hidden="true" className="@container">
      <div className="grid auto-rows-fr gap-3 @min-[48rem]:grid-cols-2">
        {[0, 1, 2, 3].map(index => (
          <Panel key={index} className="@container min-w-0 space-y-3 p-3.5 sm:p-4">
            <div className="space-y-1"><Skeleton className="h-5 w-28" /><Skeleton className="h-4 w-36" /></div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 @xl:grid-cols-4">
              {[0, 1, 2, 3].map(bucket => (
                <div key={bucket} className="space-y-1"><Skeleton className="h-4 w-14 max-w-full" /><Skeleton className="h-5 w-20 max-w-full" /></div>
              ))}
            </div>
            <div className="flex min-h-11 items-center border-t border-border pt-1 lg:min-h-9">
              <Skeleton className="ml-2 h-5 w-24" />
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}

export function ForecastPageSkeleton() {
  return (
    <PageContainer className="max-w-6xl space-y-5 py-4 sm:py-6" role="status" aria-label="Loading forecast">
      <div className="space-y-2"><Skeleton className="h-7 w-32 sm:h-[34px]" /><Skeleton className="h-5 w-72 max-w-full" /></div>
      <Panel className="space-y-3 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3"><Skeleton className="h-6 w-24" /><Skeleton className="h-11 w-32 rounded-control" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map(index => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-11 w-full rounded-control" />
              {index === 1 && <Skeleton className="h-8 w-full" />}
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="ml-auto h-11 w-28 rounded-full" />
      </Panel>
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <ForecastCyclesSkeleton />
      </div>
    </PageContainer>
  )
}
