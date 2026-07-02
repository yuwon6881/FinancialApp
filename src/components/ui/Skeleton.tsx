import React from 'react'
import { cn } from '../../lib/utils'

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-md bg-muted/70', className)} />
)

export const CardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-3 h-2 w-full" />
    <Skeleton className="mt-2 h-2 w-2/3" />
  </div>
)
