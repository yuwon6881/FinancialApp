import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ResponsiveChartFrameProps extends HTMLAttributes<HTMLDivElement> {
  density?: 'compact' | 'standard'
}

/** Reserve space outside the plot so scrubbing never covers a line or moves the chart. */
export function ChartPointReadout({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" data-chart-point-readout
      className="pointer-events-none flex min-h-10 flex-wrap content-center items-baseline gap-x-3 gap-y-0.5 text-caption tabular-nums text-muted-foreground">
      {children}
    </div>
  )
}

export function ResponsiveChartFrame({
  density = 'standard',
  className,
  ...props
}: ResponsiveChartFrameProps) {
  return (
    <div
      className={cn(
        'relative w-full min-w-0 overflow-visible',
        density === 'compact'
          ? 'aspect-[25/6] min-h-32 max-h-44 sm:min-h-36 lg:min-h-40'
          : 'aspect-[3/1] min-h-40 max-h-60 sm:min-h-48 lg:min-h-52',
        className,
      )}
      {...props}
    />
  )
}
