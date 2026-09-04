import React from 'react'
import { cn } from '../../lib/utils'

interface MeterProps {
  /** 0-100. Clamped here so a caller's domain arithmetic cannot render a bar wider than its track. */
  percent: number
  /**
   * A sentence describing what the bar shows, e.g. "RM 32.21 of RM 350.00 set aside".
   * Screen readers announce this alongside the percentage.
   */
  label: string
  /** Semantic fill class, e.g. `bg-accent-ink`. Defaults to the primary accent. */
  tone?: string
  /**
   * Explicit fill color, for bars tinted by a bucket rather than by status. Overrides the tone
   * class, so callers pass one or the other.
   */
  color?: string
  /** Track height: `sm` for a figure inside a detail row, `md` for a card's headline. */
  size?: 'sm' | 'md'
  /**
   * Omits `aria-value*` so a figure derived from a masked amount is not announced. The bar still
   * draws its width, which is what sensitive mode already shows on screen; what it must not do is
   * hand the number to a screen reader. Pass the caller's `hideSensitive` here, and give `label`
   * wording that does not contain the amount either.
   */
  valueHidden?: boolean
  className?: string
}

/**
 * A single-value progress bar.
 *
 * Uses `role="progressbar"` with `aria-valuenow` rather than `role="img"`: the value changes, and a
 * static image role forces every caller to spell the number out in a hand-written label. The
 * width transition is a compositor-friendly property and is covered by the global reduced-motion
 * rule, so callers do not need `useReducedMotion`.
 */
export const Meter: React.FC<MeterProps> = ({
  percent,
  label,
  tone = 'bg-primary',
  color,
  size = 'md',
  valueHidden = false,
  className,
}) => {
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-muted',
        size === 'sm' ? 'h-1' : 'h-1.5',
        className,
      )}
      role="progressbar"
      {...(valueHidden ? {} : {
        'aria-valuenow': Math.round(clamped),
        'aria-valuemin': 0,
        'aria-valuemax': 100,
      })}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', !color && tone)}
        style={{ width: `${clamped}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  )
}
