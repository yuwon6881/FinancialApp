import React from 'react'
import { cn } from '../../lib/utils'

/**
 * Elegant shimmering skeleton loader — a soft gradient sweeps across a muted
 * base instead of a jarring pulse or spinner. See `.skeleton-shimmer` in
 * index.css (respects prefers-reduced-motion).
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('skeleton-shimmer rounded-md', className)} />
)

export const CardSkeleton: React.FC = () => (
  <div className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="size-8 rounded-lg" />
    </div>
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-3 h-2 w-full" />
    <Skeleton className="mt-2 h-2 w-2/3" />
  </div>
)
