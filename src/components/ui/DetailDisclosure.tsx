import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DetailDisclosureProps {
  /** Summary text, e.g. "Details" or "Loan details". */
  label: string
  /** Optional right-aligned chip in the summary row, typically a count or a status word. */
  aside?: React.ReactNode
  children: React.ReactNode
  /** Controlled open state. Callers own it so a breakpoint change can re-establish the default. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Hide the summary from this breakpoint up, making the tail a phone-only affordance.
   *
   * The caller must seed `open` from `!isMobile` (and re-seed it when the breakpoint changes), the
   * way LoanCard does — otherwise the body would be unreachable at a width with no summary to tap.
   */
  expandedFrom?: 'lg'
  className?: string
  bodyClassName?: string
}

/**
 * The card detail tail: a summary row that reveals secondary figures.
 *
 * Deliberately a native `<details>`/`<summary>`, which brings keyboard activation and the expanded
 * state for free — and which existing tests assert against via `closest('details').open`. It stays
 * *controlled* because native `<details>` reveals its children before React sees the toggle event,
 * so an uncontrolled one can flash stale content.
 *
 * Not built on `CollapsibleBody`: that keeps children mounted, which would put every card's full
 * stat grid in the DOM even inside a horizontally-scrolling rail.
 */
export const DetailDisclosure: React.FC<DetailDisclosureProps> = ({
  label,
  aside,
  children,
  open,
  onOpenChange,
  expandedFrom,
  className,
  bodyClassName,
}) => {
  return (
    <details
      className={cn('group/detail', className)}
      open={open}
      onToggle={event => {
        const next = (event.currentTarget as HTMLDetailsElement).open
        if (next !== open) onOpenChange(next)
      }}
    >
      <summary
        className={cn(
          'flex min-h-11 cursor-pointer select-none items-center gap-2 text-eyebrow uppercase',
          'tracking-wider text-muted-foreground outline-none transition-colors hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-9',
          expandedFrom === 'lg' && 'lg:hidden',
        )}
      >
        <span>{label}</span>
        {aside}
        <ChevronDown
          className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-open/detail:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className={cn('pt-2', bodyClassName)}>{children}</div>
    </details>
  )
}
