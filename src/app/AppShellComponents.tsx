import { Skeleton } from '../components/ui/Skeleton'

// Instant, flash-free placeholder while a lazily-loaded chunk is fetched at the root level.
export const ViewFallback = () => <div className="app-shell min-h-screen" />

export const CycleSkeletonFallback = () => (
  <div className="space-y-6" aria-hidden="true">
    <Skeleton className="h-40 w-full rounded-2xl" />
    <Skeleton className="h-64 w-full rounded-2xl" />
  </div>
)
