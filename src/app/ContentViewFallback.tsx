import { lazy, Suspense } from 'react'
import type { AppTab } from '../types'
import { Skeleton } from '../components/ui/Skeleton'
import { getPageSkeletonVariant } from './pageSkeletonUtils'

const CycleSkeleton = lazy(() => import('../components/ui/CycleSkeleton').then(module => ({ default: module.CycleSkeleton })))

/** Page-shaped placeholder shown while a lazily loaded view's chunk is fetched. */
export const ContentViewFallback = ({ tab }: { tab: AppTab }) => (
  <div className="w-full pt-2 view-enter">
    <Suspense fallback={<div className="space-y-6" aria-hidden="true"><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>}>
      <CycleSkeleton variant={getPageSkeletonVariant(tab)} fullPage />
    </Suspense>
  </div>
)
