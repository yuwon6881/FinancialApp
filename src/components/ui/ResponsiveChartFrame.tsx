import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface ResponsiveChartFrameProps extends HTMLAttributes<HTMLDivElement> {
  density?: 'compact' | 'standard'
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
