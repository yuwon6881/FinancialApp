import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** false renders the dashed, dimmed "inactive" look used for paused/disabled entities. */
  active?: boolean
}

// Shared `rounded-2xl bg-card border ...` container -- extracted from the
// repeated card markup duplicated across the list views. Static (non-animated)
// only; views that animate their cards (e.g. RecurringPaymentsView's grid item)
// keep using motion.div directly since Card can't wrap framer-motion's props.
export function Card({ active = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'min-w-0 p-6 rounded-2xl bg-card border transition-all duration-300',
        active ? 'border-border/60 shadow-xs' : 'border-dashed border-border/60 opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
