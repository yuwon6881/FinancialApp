import React, { useMemo } from 'react'
import type { Loan, RecurringPayment } from '../../types'
import { hasBillingEnded, normalizeRecurringFrequency } from '../../lib/recurringPayments'
import { getCategoryBadgeClass, getCategoryDotClass } from '../../lib/categoryColors'
import { Badge } from '../ui/Badge'

export type DistributionBreakdownMode = 'recurring-annual' | 'loan-owed' | 'loan-annual'

export interface StatDistributionBreakdownProps {
  mode: DistributionBreakdownMode
  payments?: RecurringPayment[]
  loans?: Loan[]
  totalCommittedAnnual?: number
  loanTotalOutstanding?: number | null
  loanTotalAnnual?: number | null
  formatSensitive: (value: number) => React.ReactNode
  hideSensitive?: boolean
  className?: string
}

interface BreakdownRow {
  id: string
  name: string
  category?: string
  primaryAmount: number
  secondaryLabel?: string
  monthlyAmount?: number
  originalPrincipal?: number
  percentage: number
}

export const StatDistributionBreakdown: React.FC<StatDistributionBreakdownProps> = ({
  mode,
  payments = [],
  loans = [],
  totalCommittedAnnual = 0,
  loanTotalOutstanding = null,
  loanTotalAnnual = null,
  formatSensitive,
  className = '',
}) => {
  const { title, subtitle, rows, totalFormatted } = useMemo(() => {
    if (mode === 'recurring-annual') {
      const active = payments.filter(p => p.active && !hasBillingEnded(p))
      const calculatedRows: BreakdownRow[] = active.map(p => {
        const rawAmt = Math.abs(p.amount)
        const isAnnual = normalizeRecurringFrequency(p.frequency) === 'Annually'
        const annualAmt = isAnnual ? rawAmt : rawAmt * 12
        const monthlyAmt = annualAmt / 12
        const pct = totalCommittedAnnual > 0 ? (annualAmt / totalCommittedAnnual) * 100 : 0

        return {
          id: p.id,
          name: p.name,
          category: p.category,
          primaryAmount: annualAmt,
          secondaryLabel: `${isAnnual ? 'Billed annually' : 'Billed monthly'} · approx. / mo`,
          monthlyAmount: monthlyAmt,
          percentage: pct,
        }
      }).sort((a, b) => b.primaryAmount - a.primaryAmount)

      return {
        title: 'Yearly Bills Distribution',
        subtitle: `${active.length} active recurring ${active.length === 1 ? 'bill' : 'bills'}`,
        rows: calculatedRows,
        totalFormatted: formatSensitive(totalCommittedAnnual),
      }
    }

    if (mode === 'loan-owed') {
      const validLoans = loans.filter(l => !l.isPendingDelete)
      const isUnavailable = loanTotalOutstanding == null || validLoans.some(l => l.scheduleStatus === 'Incomplete' || l.isRecalculating)

      if (isUnavailable) {
        return {
          title: 'Loan Debt Distribution',
          subtitle: 'History recalculating or incomplete',
          rows: [],
          totalFormatted: 'Unavailable',
        }
      }

      const totalOwed = loanTotalOutstanding ?? validLoans.reduce((sum, l) => sum + Math.max(0, l.snapshot.outstandingBalance), 0)
      const calculatedRows: BreakdownRow[] = validLoans.map(l => {
        const owed = Math.max(0, l.snapshot.outstandingBalance)
        const pct = totalOwed > 0 ? (owed / totalOwed) * 100 : 0

        return {
          id: l.id,
          name: l.name,
          category: 'Loan',
          primaryAmount: owed,
          secondaryLabel: `Original: `,
          originalPrincipal: l.openingPrincipal,
          percentage: pct,
        }
      }).sort((a, b) => b.primaryAmount - a.primaryAmount)

      return {
        title: 'Total Still Owed Distribution',
        subtitle: `${validLoans.length} tracked ${validLoans.length === 1 ? 'loan' : 'loans'}`,
        rows: calculatedRows,
        totalFormatted: formatSensitive(totalOwed),
      }
    }

    // mode === 'loan-annual'
    const validLoans = loans.filter(l => !l.isPendingDelete)
    const isUnavailable = loanTotalAnnual == null || validLoans.some(l => l.scheduleStatus === 'Incomplete' || l.isRecalculating)

    if (isUnavailable) {
      return {
        title: 'Yearly Loan Commitment',
        subtitle: 'Schedule recalculating or incomplete',
        rows: [],
        totalFormatted: 'Unavailable',
      }
    }

    const totalAnnual = loanTotalAnnual ?? 0
    const calculatedRows: BreakdownRow[] = validLoans
      .filter(l => l.snapshot.outstandingBalance > 0)
      .map(l => {
        const isAnnual = l.scheduleFrequency === 'Annually'
        const annualAmt = isAnnual ? l.snapshot.scheduledPayment : l.snapshot.scheduledPayment * 12
        const monthlyAmt = isAnnual ? l.snapshot.scheduledPayment / 12 : l.snapshot.scheduledPayment
        const pct = totalAnnual > 0 ? (annualAmt / totalAnnual) * 100 : 0

        return {
          id: l.id,
          name: l.name,
          category: 'Loan',
          primaryAmount: annualAmt,
          secondaryLabel: `${isAnnual ? 'Annual payment' : 'Monthly payment'} · approx. / mo`,
          monthlyAmount: monthlyAmt,
          percentage: pct,
        }
      }).sort((a, b) => b.primaryAmount - a.primaryAmount)

    return {
      title: 'Yearly Loan Distribution',
      subtitle: `${calculatedRows.length} active repayment ${calculatedRows.length === 1 ? 'schedule' : 'schedules'}`,
      rows: calculatedRows,
      totalFormatted: formatSensitive(totalAnnual),
    }
  }, [formatSensitive, loanTotalAnnual, loanTotalOutstanding, loans, mode, payments, totalCommittedAnnual])

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-2 border-b border-border/40 pb-2.5">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-foreground sm:text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground sm:text-xs">{subtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-extrabold text-blue-500 sm:text-sm">{totalFormatted}</span>
          <span className="block text-eyebrow uppercase text-muted-foreground">
            {mode === 'loan-owed' ? 'total owed' : 'total / year'}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          {totalFormatted === 'Unavailable'
            ? 'Schedule forecasts will appear once loan data is synced.'
            : 'No active items contributing to this total.'}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-2.5 pr-0.5" tabIndex={0} aria-label={`${title} list`}>
          {rows.map(row => (
            <div
              key={row.id}
              className="group rounded-xl border border-border/50 bg-background/50 p-2.5 transition-colors hover:bg-muted/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-xs font-bold text-foreground" title={row.name}>
                      {row.name}
                    </span>
                    {row.category && (
                      <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0 ${getCategoryBadgeClass(row.category)}`}>
                        <span className={`size-1.5 rounded-full mr-1 ${getCategoryDotClass(row.category)}`} />
                        {row.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                    {mode === 'loan-owed' && row.originalPrincipal !== undefined ? (
                      <span>Original principal: {formatSensitive(row.originalPrincipal)}</span>
                    ) : row.monthlyAmount !== undefined ? (
                      <span>{formatSensitive(row.monthlyAmount)} / month</span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      {formatSensitive(row.primaryAmount)}
                    </span>
                    <Badge tone="neutral">
                      {row.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {mode === 'loan-owed' ? 'outstanding' : 'per year'}
                  </span>
                </div>
              </div>

              {/* Proportional visual bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300 group-hover:bg-blue-400"
                  style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
