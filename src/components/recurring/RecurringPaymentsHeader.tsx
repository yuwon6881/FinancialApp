import React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { AnchoredPopover } from '../ui/AnchoredPopover'
import { BottomSheet } from '../ui/BottomSheet'
import { useIsCompact } from '../../lib/breakpoints'
import type { Loan, RecurringPayment } from '../../types'
import { StatDistributionBreakdown, type DistributionBreakdownMode } from './StatDistributionBreakdown'

interface RecurringPaymentsHeaderProps {
  activeView: 'recurring' | 'loans'
  totalCommittedMonthly: number
  totalCommittedAnnual: number
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
  <div className={`min-w-0 overflow-hidden ${className}`}>
    <span className="block text-xs font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs sm:tracking-wider">
      {label}
    </span>
    <span
      title={title}
      className={`block truncate text-base font-extrabold sm:text-2xl ${tone === 'figure' ? 'text-blue-500' : 'text-foreground'}`}
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
  const id = React.useId()

  React.useEffect(() => {
    if (!pinned) return
    const dismiss = (event: Event) => {
      if (anchorRef.current?.contains(event.target as Node)) return
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
  }, [pinned])

  const sheetTitle = mode === 'recurring-annual'
    ? 'Yearly Bills Distribution'
    : mode === 'loan-owed'
      ? 'Total Still Owed Distribution'
      : 'Yearly Loan Distribution'

  return (
    <div className={`min-w-0 overflow-hidden ${className}`}>
      <Button
        variant="unstyled"
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
        className="group/stat block w-full text-left cursor-pointer select-none rounded-lg p-1 -m-1 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div className="flex items-center gap-1">
          <span className="block text-xs font-bold uppercase leading-tight tracking-wide text-muted-foreground transition-colors group-hover/stat:text-foreground sm:text-xs sm:tracking-wider">
            {label}
          </span>
          <span className="rounded bg-muted/60 px-1 py-0.5 text-xs font-semibold text-muted-foreground opacity-70 group-hover/stat:opacity-100 transition-opacity">
            Breakdown
          </span>
        </div>
        <span
          title={title}
          className={`block truncate text-base font-extrabold sm:text-2xl ${tone === 'figure' ? 'text-blue-500' : 'text-foreground'}`}
        >
          {value}
        </span>
      </Button>

      {/* Desktop Popover */}
      {!isMobile && (
        <AnchoredPopover
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
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 w-full md:flex-1">
          <h2 id={isLoansView ? 'loans-heading' : 'recurring-payments-heading'} className="text-xl font-bold text-foreground">
            {isLoansView ? 'Loans' : 'Recurring Bills & Subscriptions'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoansView ? 'Track what is still owed from linked bill history.' : 'Manage your recurring bills.'}
          </p>
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 sm:gap-y-0">
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
                  className="border-l border-border/60 pl-2 pr-1 sm:px-2"
                />
                <StatTile
                  label="Loans tracked"
                  value={loanCount}
                  tone="count"
                  className="col-span-2 border-t border-border/60 pt-2 sm:col-span-1 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
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
                  className="border-l border-border/60 pl-2 pr-1 sm:px-2"
                />
                <StatTile
                  label="Active bills"
                  value={`${activeCount} / ${totalCount}`}
                  tone="count"
                  className="col-span-2 border-t border-border/60 pt-2 sm:col-span-1 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-0"
                />
              </>
            )}
          </div>
        </div>
        {isLoansView ? (
          <Button
            variant="primary"
            size="lg"
            onClick={onAddLoan}
            disabled={hideSensitive || !onAddLoan}
            title={hideSensitive ? 'Unhide balances to add a loan' : undefined}
            className="rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 self-start md:self-center"
          >
            <Plus className="size-4" />
            New Loan
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={onToggleForm}
            disabled={hideSensitive}
            title={hideSensitive ? 'Unhide balances to add a subscription' : undefined}
            className="rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 self-start md:self-center"
          >
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showAddForm ? 'Cancel' : 'New Subscription'}
          </Button>
        )}
      </Card>
    </div>
  )
}
