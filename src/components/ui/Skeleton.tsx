import React from 'react'
import { cn } from '../../lib/utils'

/**
 * Reusable shimmer placeholder for the app shell and small inline loading states.
 * Page-specific layouts live in CycleSkeleton so they do not inflate the eager shell.
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('skeleton-shimmer rounded-md', className)} />
)
