import { useMemo, useState } from 'react'
import type { DashboardData } from '../../types'
import { useAppPrefs } from '../../contexts/AppContext'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { InteractiveDoughnutChart } from '../ui/InteractiveDoughnutChart'
import { ReportSegmented } from '../reports/ReportSegmented'

type ChartRange = 'monthly' | '3month' | '6month' | 'yearly'

interface DoughnutChartProps {
  dashboardData: DashboardData | null
  selectedYear: number
  onNavigateToLedger?: (options: { category?: string | null; range?: ChartRange }) => void
}

const RANGE_OPTIONS = [
  { value: 'monthly', label: '1M', ariaLabel: 'Selected cycle' },
  { value: '3month', label: '3M', ariaLabel: 'Last 3 months' },
  { value: '6month', label: '6M', ariaLabel: 'Last 6 months' },
  { value: 'yearly', label: 'Year', ariaLabel: 'Full year' },
] as const

/**
 * Outflow by category: the ring and its legend side by side once the block has room, stacked on a
 * phone. Drawn without a surface of its own -- it is one half of the report's "Where it went"
 * panel, beside the category limits.
 */
export function DoughnutChart({ dashboardData, selectedYear, onNavigateToLedger }: DoughnutChartProps) {
  const prefs = useAppPrefs()
  const { formatSensitive } = prefs
  const hideSensitive = prefs.maskPassiveFinancialFigures ?? prefs.hideSensitive
  const [chartView, setChartView] = useState<ChartRange>('monthly')

  const breakdownData = useMemo(() => {
    if (chartView === 'yearly') return dashboardData?.yearlyCategoryBreakdown ?? []
    if (chartView === '3month') return dashboardData?.last3CategoryBreakdown ?? []
    if (chartView === '6month') return dashboardData?.last6CategoryBreakdown ?? []
    return dashboardData?.monthlyCategoryBreakdown ?? []
  }, [chartView, dashboardData])

  const total = useMemo(
    () => breakdownData.reduce((sum, item) => sum + item.amount, 0),
    [breakdownData]
  )

  const slices = useMemo(() => breakdownData.map(item => ({
    key: `${chartView}-${item.category}`,
    label: item.category,
    value: item.amount,
    color: getCategoryChartColor(item.category),
  })), [breakdownData, chartView])

  const rangeLabel = chartView === 'monthly' ? 'the selected cycle'
    : chartView === '3month' ? 'the last 3 cycles'
      : chartView === '6month' ? 'the last 6 cycles'
        : `${selectedYear}`
  const largest = breakdownData.reduce<(typeof breakdownData)[number] | null>(
    (current, item) => current === null || item.amount > current.amount ? item : current,
    null,
  )
  const chartSummary = hideSensitive
    ? `Expense breakdown for ${rangeLabel}. Values are hidden.`
    : total > 0
    ? `Expense breakdown for ${rangeLabel}. Total ${formatSensitive(total)} across ${slices.length} categor${slices.length === 1 ? 'y' : 'ies'}. Largest: ${largest?.category} at ${largest ? (largest.amount / total * 100).toFixed(0) : 0}%.`
    : `Expense breakdown for ${rangeLabel}. No outflows logged.`
  const shareCaption = chartView === 'monthly' ? 'Selected cycle outflow share'
    : chartView === '3month' ? 'Last 3 cycles outflow share'
      : chartView === '6month' ? 'Last 6 cycles outflow share'
        : `Full ${selectedYear} outflow share`

  return (
    <div className="@container min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 id="report-outflow-heading" className="text-subsection text-foreground">Outflow categories</h3>
          <p className="mt-0.5 text-caption text-muted-foreground">{shareCaption}</p>
        </div>
        <ReportSegmented label="Breakdown range" value={chartView} onChange={setChartView} options={RANGE_OPTIONS} />
      </div>

      {total > 0 ? (
        <div className="mt-5 flex min-w-0 flex-col items-center gap-5 @sm:flex-row @sm:items-center @sm:gap-5">
          <InteractiveDoughnutChart
            slices={slices}
            ariaLabel={chartSummary}
            centerLabel="Total"
            centerValue={formatSensitive(total)}
            formatValue={formatSensitive}
            masked={hideSensitive}
            chartClassName="size-48 @sm:size-44 @2xl:size-48"
            legendClassName="grid max-h-56 w-full min-w-0 flex-1 @sm:max-w-sm content-start gap-y-0.5 overflow-y-auto no-scrollbar [&>button]:min-h-11 lg:[&>button]:min-h-9"
            onActivate={slice => onNavigateToLedger?.({ category: slice.label, range: chartView })}
          />
        </div>
      ) : (
        <div className="mt-4 flex h-40 items-center justify-center rounded-control bg-surface-2/70 p-4 text-center">
          <span className="text-caption text-muted-foreground">No outflows logged.</span>
        </div>
      )}
    </div>
  )
}
