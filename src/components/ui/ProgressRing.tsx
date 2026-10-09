import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ProgressRingProps {
  /** 0-100; clamped. */
  percent: number
  /** A sentence describing what the ring shows; announced with the value. */
  label: string
  /** Diameter in px. */
  size?: number
  /** Stroke width in px. */
  thickness?: number
  /** Stroke colour as a CSS colour or variable. Defaults to the brand colour. */
  color?: string
  /** Same contract as `Meter`: draws the arc, announces nothing, for figures derived from masked amounts. */
  valueHidden?: boolean
  /** Content centred inside the ring, e.g. a day count or a percentage. */
  children?: ReactNode
  className?: string
}

/**
 * A single-value circular progress indicator: the cycle's day count, a bucket's funding, a loan's
 * payoff. The arc eases to its value with a CSS transition on `stroke-dashoffset` (covered by the
 * global reduced-motion rule) and starts at twelve o'clock.
 */
export function ProgressRing({
  percent,
  label,
  size = 56,
  thickness = 5,
  color = 'var(--primary)',
  valueHidden = false,
  children,
  className,
}: ProgressRingProps) {
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      {...(valueHidden ? {} : { 'aria-valuenow': Math.round(clamped), 'aria-valuemin': 0, 'aria-valuemax': 100 })}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-fluid"
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
      )}
    </div>
  )
}
