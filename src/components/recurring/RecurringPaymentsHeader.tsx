import React from 'react'
import { ChartPie, Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { AnchoredPopover } from '../ui/AnchoredPopover'
import { BottomSheet } from '../ui/BottomSheet'
import { useIsCompact } from '../../lib/breakpoints'
import type { Loan, RecurringPayment } from '../../types'
import { StatDistributionBreakdown, type DistributionBreakdownMode } from './StatDistributionBreakdown'
import { PageHeader } from '../ui/PageHeader'

interface RecurringPaymentsHeaderProps {
  activeView: 'recurring' | 'loans'
  totalCommittedMonthly: number
  totalCommittedAnnual: number
  totalCommittedDaily: number
  activeCount: number
  totalCount: number
  loanTotalOutstanding?: number | null
  loanTotalAnnual?: number | null
  loanCount?: number
  payments?: RecurringPayment[]
  loans?: Loan[]
  showAddForm: boolean
  hideSensitive: boolean
  formatSensitive: (val: number) => React.ReactNode
  onToggleForm: () => void
  onAddLoan?: () => void
}

/**
 * One stat tile. Both tabs render the same tile so the summary card keeps its shape when the
 * view switches -- the values differ, the type scale and truncation behaviour do not.
 */
const StatTile: React.FC<{
  label: string
  value: React.ReactNode
  tone?: 'figure' | 'count'
  title?: string
  className?: string
}> = ({ label, value, tone = 'figure', title, className = '' }) => (
  // `justify-between` pins the value to the bottom of the row so every tile's figure sits on one
  // line, even when a neighbour's label needs two.
  <div className={`flex h-full min-w-0 flex-col justify-between overflow-hidden ${className}`}>
    <span className="block text-eyebrow uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs sm:tracking-wider">
      {label}
    </span>
    <span
      title={title}
      className={`block truncate text-base font-extrabold sm:text-xl ${tone === 'figure' ? 'text-blue-500' : 'text-foreground'}`}
    >
      {value}
    </span>
  </div>
)

const InteractiveStatTile: React.FC<{
  label: string
  value: React.ReactNode
  tone?: 'figure' | 'count'
  title?: string
  className?: string
  mode: DistributionBreakdownMode
  payments?: RecurringPayment[]
  loans?: Loan[]
  totalCommittedAnnual?: number
  loanTotalOutstanding?: number | null
  loanTotalAnnual?: number | null
  formatSensitive: (val: number) => React.ReactNode
  hideSensitive?: boolean
  isMobile: boolean
}> = ({
  label,
  value,
  tone = 'figure',
  title,
  className = '',
  mode,
  payments,
  loans,
  totalCommittedAnnual,
  loanTotalOutstanding,
  loanTotalAnnual,
  formatSensitive,
  hideSensitive,
  isMobile,
}) => {
  const [open, setOpen] = React.useState(false)
  const [pinned, setPinned] = React.useState(false)
  const anchorRef = React.useRef<HTMLButtonElement | null>(null)
  const popoverRef = React.useRef<HTMLDivElement | null>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (!pinned || isMobile) return
    const dismiss = (event: Event) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setPinned(false)
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned, isMobile])

  const sheetTitle = mode === 'recurring-annual'
    ? 'Yearly Bills Distribution'
    : mode === 'loan-owed'
      ? 'Total Still Owed Distribution'
      : 'Yearly Loan Distribution'

  return (
    <div className={`flex h-full min-w-0 flex-col overflow-hidden ${className}`}>
      <Button
        variant="tertiary"
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open || pinned}
        aria-controls={(open || pinned) ? id : undefined}
        onClick={() => {
          const next = !pinned
          setPinned(next)
          setOpen(next)
        }}
        onMouseEnter={() => { if (!isMobile) setOpen(true) }}
        onMouseLeave={() => { if (!isMobile && !pinned) setOpen(false) }}
        onFocus={() => { if (!isMobile) setOpen(true) }}
        onBlur={() => { if (!isMobile && !pinned) setOpen(false) }}
        // The hover surface covers the tile exactly. It used to bleed 4px sideways (`px-1 -mx-1`),
        // which put the truncation edge of a long figure right on the neighbour's divider -- the
        // yearly total and the count beside it read as one run-on number.
        className="group/stat flex h-full w-full flex-col items-start justify-between text-left cursor-pointer select-none rounded-lg p-0 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {/* One line, always. The word "Breakdown" used to sit here as a second pill; on a phone it
            wrapped below the label, and because every tile pins its figure to the bottom of the
            row, that extra line stretched the whole grid -- the plain "Monthly Total" beside this
            one grew a gap the height of a word between its label and its number. A chart glyph
            says the same thing inside the label's own line, and the word survives for screen
            readers on the button's accessible name. */}
        <div className="flex min-w-0 items-center gap-1">
          <span className="block whitespace-nowrap text-eyebrow uppercase leading-tight tracking-wide text-muted-foreground transition-colors group-hover/stat:text-foreground sm:text-xs sm:tracking-wider">
            {label}
          </span>
          <ChartPie
            className="size-3.5 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover/stat:opacity-100"
            aria-hidden="true"
          />
          <span className="sr-only">breakdown</span>
        </div>
        <span
          title={title}
          className={`block truncate text-base font-extrabold sm:text-xl ${tone === 'figure' ? 'text-blue-500' : 'text-foreground'}`}
        >
          {value}
        </span>
      </Button>

      {/* Desktop Popover */}
      {!isMobile && (
        <AnchoredPopover
          ref={popoverRef}
          open={open || pinned}
          anchorRef={anchorRef}
          align="left"
          side="bottom"
          role="dialog"
          aria-label={sheetTitle}
          id={id}
          className="w-84 rounded-2xl border border-border bg-card p-4 shadow-xl z-[200] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <StatDistributionBreakdown
            mode={mode}
            payments={payments}
            loans={loans}
            totalCommittedAnnual={totalCommittedAnnual}
            loanTotalOutstanding={loanTotalOutstanding}
            loanTotalAnnual={loanTotalAnnual}
            formatSensitive={formatSensitive}
            hideSensitive={hideSensitive}
          />
        </AnchoredPopover>
      )}

      {/* Mobile BottomSheet */}
      {isMobile && (
        <BottomSheet
          isOpen={pinned}
          title={sheetTitle}
          onClose={() => { setPinned(false); setOpen(false) }}
        >
          <div className="p-1">
            <StatDistributionBreakdown
              mode={mode}
              payments={payments}
              loans={loans}
              totalCommittedAnnual={totalCommittedAnnual}
              loanTotalOutstanding={loanTotalOutstanding}
              loanTotalAnnual={loanTotalAnnual}
              formatSensitive={formatSensitive}
              hideSensitive={hideSensitive}
            />
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

// Header section with Stats
export const RecurringPaymentsHeader: React.FC<RecurringPaymentsHeaderProps> = ({
  activeView,
  totalCommittedMonthly,
  totalCommittedAnnual,
  totalCommittedDaily,
  activeCount,
  totalCount,
  loanTotalOutstanding = null,
  loanTotalAnnual = null,
  loanCount = 0,
  payments = [],
  loans = [],
  showAddForm,
  hideSensitive,
  formatSensitive,
  onToggleForm,
  onAddLoan,
}) => {
  const isLoansView = activeView === 'loans'
  const isMobile = useIsCompact()

  return (
    <div className="w-full">
      <PageHeader
        titleId={isLoansView ? 'loans-heading' : 'recurring-payments-heading'}
        title={isLoansView ? 'Loans' : 'Recurring Bills & Subscriptions'}
        description={isLoansView ? 'Track what is still owed from linked bill history.' : 'Manage your recurring bills.'}
        actions={isLoansView ? (
          <Button variant="primary" size="lg" onClick={onAddLoan} disabled={hideSensitive || !onAddLoan} title={hideSensitive ? 'Unhide balances to add a loan' : undefined}>
            <Plus className="size-4" />New Loan
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={onToggleForm} disabled={hideSensitive} title={hideSensitive ? 'Unhide balances to add a subscription' : undefined}>
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showAddForm ? 'Cancel' : 'New Subscription'}
          </Button>
        )}
      >
          {/* Two figures per row until the rail-narrowed page can hold four. At the medium tier a
              four-column row gave each currency figure about a hundred pixels, so neighbouring
              totals ran into the divider between them. */}
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-x-2 gap-y-3 lg:grid-cols-4 lg:gap-y-0">
            {isLoansView ? (
              <>
                <InteractiveStatTile
                  label="Total still owed"
                  value={loanTotalOutstanding == null ? 'Unavailable' : formatSensitive(loanTotalOutstanding)}
                  mode="loan-owed"
                  loans={loans}
                  loanTotalOutstanding={loanTotalOutstanding}
                  formatSensitive={formatSensitive}
                  hideSensitive={hideSensitive}
                  isMobile={isMobile}
                  className="pr-2"
                />
                <InteractiveStatTile
                  label="Yearly Total"
                  value={loanTotalAnnual == null ? 'Unavailable' : formatSensitive(loanTotalAnnual)}
                  mode="loan-annual"
                  loans={loans}
                  loanTotalAnnual={loanTotalAnnual}
                  formatSensitive={formatSensitive}
                  hideSensitive={hideSensitive}
                  isMobile={isMobile}
                  className="border-l border-border/60 pl-2 pr-1 lg:px-2"
                />
                <StatTile
                  label="Loans tracked"
                  value={loanCount}
                  tone="count"
                  className="col-span-2 border-t border-border/60 pt-3 lg:col-span-1 lg:border-t-0 lg:border-l lg:pl-2 lg:pt-0"
                />
              </>
            ) : (
              <>
                <StatTile label="Monthly Total" value={formatSensitive(totalCommittedMonthly)} className="pr-2" />
                <InteractiveStatTile
                  label="Yearly Total"
                  value={formatSensitive(totalCommittedAnnual)}
                  mode="recurring-annual"
                  payments={payments}
                  totalCommittedAnnual={totalCommittedAnnual}
                  formatSensitive={formatSensitive}
                  hideSensitive={hideSensitive}
                  isMobile={isMobile}
                  className="border-l border-border/60 pl-2 pr-1 lg:px-2"
                />
                <StatTile
                  label="Daily Cost"
                  value={formatSensitive(totalCommittedDaily)}
                  className="border-t border-border/60 pr-2 pt-3 lg:border-t-0 lg:border-l lg:px-2 lg:pt-0"
                />
                <StatTile
                  label="Active bills"
                  value={`${activeCount} / ${totalCount}`}
                  tone="count"
                  className="border-l border-t border-border/60 pl-2 pt-3 lg:border-t-0 lg:px-2 lg:pt-0"
                />
              </>
            )}
          </div>
      </PageHeader>
    </div>
  )
}
