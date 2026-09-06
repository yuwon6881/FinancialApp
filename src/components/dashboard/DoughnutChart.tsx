import { useMemo, useState } from 'react'
import type { DashboardData } from '../../types'
import { useAppPrefs } from '../../contexts/AppContext'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { InteractiveDoughnutChart } from '../ui/InteractiveDoughnutChart'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'

type ChartRange = 'monthly' | '3month' | '6month' | 'yearly'

interface DoughnutChartProps {
  dashboardData: DashboardData | null
  selectedYear: number
  onNavigateToLedger?: (options: { category?: string | null; range?: ChartRange }) => void
}

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

  return (
    <div className={cn(panelClass, 'flex min-w-0 flex-col justify-between p-4 sm:p-6')}>
      <div>
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-2">
          <div>
            <h3 className="text-section text-foreground">Outflow Categories</h3>
            <p className="text-xs text-muted-foreground">Expense breakdown by category</p>
          </div>
          <div role="group" aria-label="Breakdown range" className="grid w-full grid-cols-4 items-center rounded-lg border border-border/40 bg-muted/40 p-0.5 text-xs sm:flex sm:w-auto sm:shrink-0">
            {(['monthly', '3month', '6month', 'yearly'] as const).map(view => (
              <Button variant="tertiary"
                key={view}
                type="button"
                onClick={() => setChartView(view)}
                aria-pressed={chartView === view}
                aria-label={view === 'monthly' ? 'Selected cycle' : view === '3month' ? 'Last 3 months' : view === '6month' ? 'Last 6 months' : 'Full year'}
                className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-2.5 py-1 font-bold transition cursor-pointer sm:min-h-8 ${
                  chartView === view ? 'bg-background hover:bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {view === 'monthly' ? '1M' : view === '3month' ? '3M' : view === '6month' ? '6M' : 'Year'}
              </Button>
            ))}
          </div>
        </div>

        {total > 0 ? (
          <div className="mt-2 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <InteractiveDoughnutChart
              slices={slices}
              ariaLabel={chartSummary}
              centerLabel="Total"
              centerValue={formatSensitive(total)}
              formatValue={formatSensitive}
              masked={hideSensitive}
              chartClassName="mx-auto size-52 sm:mx-0 sm:size-44 2xl:size-52"
              legendClassName="grid max-h-40 w-full min-w-0 grid-cols-1 content-start gap-y-1 overflow-y-auto pr-0.5 no-scrollbar"
              onActivate={slice => onNavigateToLedger?.({ category: slice.label, range: chartView })}
            />
          </div>
        ) : (
          <div className="h-52 flex flex-col items-center justify-center text-center p-4">
            <span className="text-xs text-muted-foreground">No outflows logged.</span>
          </div>
        )}
      </div>
      <div className="border-t border-border/50 pt-3 mt-3 text-xs text-muted-foreground text-center">
        {chartView === 'monthly' ? 'Selected Cycle Outflow Share'
          : chartView === '3month' ? 'Last 3 Cycles Outflow Share'
            : chartView === '6month' ? 'Last 6 Cycles Outflow Share'
              : `Full ${selectedYear} Outflow Share`}
      </div>
    </div>
  )
}
