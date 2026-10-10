import { forwardRef, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

interface InvestmentToolRowProps {
  icon: ReactNode
  title: ReactNode
  titleId?: string
  subtitle?: ReactNode
  /** Trailing content before the chevron, e.g. counts. */
  meta?: ReactNode
  onClick?: () => void
  disabled?: boolean
  expanded?: boolean
}

/**
 * One row of the "more" list under the charts: a tool that opens a sheet (the forecast, the
 * portfolio manager). It is flush with its panel, which clips it, so the hover has no corners.
 * Without `onClick` it renders as a quiet, non-interactive row -- the forecast before there is a
 * complete value to forecast from.
 */
export const InvestmentToolRow = forwardRef<HTMLButtonElement, InvestmentToolRowProps>(
  ({ icon, title, titleId, subtitle, meta, onClick, disabled, expanded }, ref) => {
    const body = (
      <>
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground dark:bg-surface-3">{icon}</span>
        <span className="min-w-0 flex-1">
          <span id={titleId} className="block truncate text-body font-medium text-foreground">{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-caption font-normal text-muted-foreground">{subtitle}</span>}
        </span>
        {meta && <span className="flex shrink-0 items-center gap-1.5">{meta}</span>}
      </>
    )
    if (!onClick) {
      return <div className="flex min-h-16 items-center gap-3 px-5 py-3 sm:px-6">{body}</div>
    }
    return (
      <Button
        ref={ref}
        variant="tertiary"
        onClick={onClick}
        disabled={disabled}
        aria-expanded={expanded}
        className={cn('group flex min-h-16 w-full items-center justify-start gap-3 rounded-none px-5 py-3 text-left hover:bg-surface-2/60 sm:px-6 lg:min-h-16')}
      >
        {body}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
      </Button>
    )
  },
)
InvestmentToolRow.displayName = 'InvestmentToolRow'
