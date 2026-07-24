import { useMemo, useState } from 'react'
import type { DashboardData } from '../../types'
import { useAppContext } from '../../contexts/AppContext'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { InteractiveDoughnutChart } from '../ui/InteractiveDoughnutChart'

type ChartRange = 'monthly' | '3month' | '6month' | 'yearly'

interface DoughnutChartProps {
  dashboardData: DashboardData | null
  selectedYear: number
  onNavigateToLedger?: (options: { category?: string | null; range?: ChartRange }) => void
}

export function DoughnutChart({ dashboardData, selectedYear, onNavigateToLedger }: DoughnutChartProps) {
  const { formatSensitive } = useAppContext()
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
  const chartSummary = total > 0
    ? `Expense breakdown for ${rangeLabel}. Total ${formatSensitive(total)} across ${slices.length} categor${slices.length === 1 ? 'y' : 'ies'}. Largest: ${largest?.category} at ${largest ? (largest.amount / total * 100).toFixed(0) : 0}%.`
    : `Expense breakdown for ${rangeLabel}. No outflows logged.`

  return (
    <div className="app-panel p-6 rounded-2xl bg-card/92 border border-border/60 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground">Outflow Categories</h3>
            <p className="text-[10px] text-muted-foreground">Expense breakdown by category</p>
          </div>
          <div role="group" aria-label="Breakdown range" className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 text-[9px] shrink-0">
            {(['monthly', '3month', '6month', 'yearly'] as const).map(view => (
              <button
                key={view}
                type="button"
                onClick={() => setChartView(view)}
                aria-pressed={chartView === view}
                aria-label={view === 'monthly' ? 'Selected cycle' : view === '3month' ? 'Last 3 months' : view === '6month' ? 'Last 6 months' : 'Full year'}
                className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  chartView === view ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {view === 'monthly' ? '1M' : view === '3month' ? '3M' : view === '6month' ? '6M' : 'Year'}
              </button>
            ))}
          </div>
        </div>

        {total > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mt-2">
            <InteractiveDoughnutChart
              slices={slices}
              ariaLabel={chartSummary}
              centerLabel="Total"
              centerValue={formatSensitive(total)}
              formatValue={formatSensitive}
              chartClassName="mx-auto size-36 sm:mx-0"
              legendClassName="grid max-h-32 w-full min-w-0 grid-cols-1 content-start gap-x-4 gap-y-0.5 overflow-y-auto pr-0.5 no-scrollbar sm:max-h-40 xl:grid-cols-2"
              onActivate={slice => onNavigateToLedger?.({ category: slice.label, range: chartView })}
            />
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4">
            <span className="text-[10px] text-muted-foreground">No outflows logged.</span>
          </div>
        )}
      </div>
      <div className="border-t border-border/50 pt-3 mt-3 text-[10px] text-muted-foreground text-center">
        {chartView === 'monthly' ? 'Selected Cycle Outflow Share'
          : chartView === '3month' ? 'Last 3 Cycles Outflow Share'
            : chartView === '6month' ? 'Last 6 Cycles Outflow Share'
              : `Full ${selectedYear} Outflow Share`}
      </div>
    </div>
  )
}
