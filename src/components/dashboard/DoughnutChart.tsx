import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { DashboardData } from '../../types'
import { useAppContext } from '../../contexts/AppContext'
import { getCategoryChartColor } from '../../lib/categoryColors'

type ChartRange = 'monthly' | '3month' | '6month' | 'yearly'

interface DoughnutChartProps {
  dashboardData: DashboardData | null
  selectedYear: number
  onNavigateToLedger?: (options: { category?: string | null; range?: ChartRange }) => void
}

export function DoughnutChart({ dashboardData, selectedYear, onNavigateToLedger }: DoughnutChartProps) {
  const { formatSensitive } = useAppContext()
  const [chartView, setChartView] = useState<ChartRange>('monthly')
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null)

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

  const slices = useMemo(() => {
    return breakdownData.reduce<Array<(typeof breakdownData)[number] & {
      percentage: number
      startAngle: number
      endAngle: number
    }>>((result, item) => {
      const percentage = total > 0 ? item.amount / total : 0
      const startAngle = result.at(-1)?.endAngle ?? 0
      const angleSweep = percentage * 360
      const endAngle = Math.min(359.99 + startAngle, startAngle + angleSweep)
      result.push({ ...item, percentage, startAngle, endAngle })
      return result
    }, [])
  }, [breakdownData, total])

  const rangeLabel = chartView === 'monthly' ? 'the selected cycle'
    : chartView === '3month' ? 'the last 3 cycles'
      : chartView === '6month' ? 'the last 6 cycles'
        : `${selectedYear}`
  const chartSummary = total > 0
    ? `Expense breakdown for ${rangeLabel}. Total ${formatSensitive(total)} across ${slices.length} categor${slices.length === 1 ? 'y' : 'ies'}. Largest: ${slices[0].category} at ${(slices[0].percentage * 100).toFixed(0)}%.`
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
            <div className="relative size-36 shrink-0 mx-auto sm:mx-0">
              <svg role="img" aria-label={chartSummary} className="size-full overflow-visible" viewBox="0 0 200 200">
                {slices.map((slice, index) => {
                  const isHovered = hoveredSlice === index
                  const targetPath = getDoughnutPath(100, 100, isHovered ? 96 : 90, isHovered ? 56 : 62, slice.startAngle, slice.endAngle)
                  return (
                    <motion.path
                      // Keyed by range + category so switching timeframe remounts every
                      // arc and replays the staggered scale/opacity fade-in, instead of
                      // persisting slices snapping their `d` to the new geometry.
                      key={`${chartView}-${slice.category}`}
                      // d is a static attribute (not animated). framer-motion can't
                      // safely interpolate arc paths: it treats `d` as a flat number
                      // list, so the A-command flags and any structural difference
                      // between renders produce a malformed `d` ("Expected number"
                      // SVG error) while navigating. Animate only scale/opacity.
                      d={targetPath}
                      fill={getCategoryChartColor(slice.category)}
                      className="transition-all duration-200 cursor-pointer stroke-card stroke-2 hover:opacity-90"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.04 }}
                      style={{ transformOrigin: '100px 100px' }}
                      onMouseEnter={() => setHoveredSlice(index)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => {
                        if (hoveredSlice === index) onNavigateToLedger?.({ category: slice.category, range: chartView })
                        else setHoveredSlice(index)
                      }}
                    />
                  )
                })}
              </svg>
              <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center p-2">
                {hoveredSlice !== null ? (
                  <>
                    <span className="text-[10px] text-muted-foreground font-bold truncate max-w-[110px] uppercase">
                      {slices[hoveredSlice].category}
                    </span>
                    <span className="text-sm font-black text-foreground">
                      {(slices[hoveredSlice].percentage * 100).toFixed(0)}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Total</span>
                    <span className="text-xs font-black text-foreground truncate max-w-[110px]">{formatSensitive(total)}</span>
                  </>
                )}
              </div>
            </div>

            <div role="list" className="w-full min-w-0 grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-0.5 content-start max-h-32 sm:max-h-40 overflow-y-auto no-scrollbar pr-0.5">
              {slices.map((slice, index) => (
                <motion.button
                  key={slice.category}
                  layout
                  type="button"
                  role="listitem"
                  aria-label={`View ${slice.category} transactions: ${formatSensitive(slice.amount)}, ${(slice.percentage * 100).toFixed(0)}% of outflows for ${rangeLabel}`}
                  className={`flex items-center justify-between text-xs py-1 px-1.5 rounded-md transition-colors duration-150 cursor-pointer text-left w-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
                    hoveredSlice === index ? 'bg-muted/50' : 'hover:bg-muted/30'
                  }`}
                  onMouseEnter={() => setHoveredSlice(index)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  onFocus={() => setHoveredSlice(index)}
                  onBlur={() => setHoveredSlice(null)}
                  onClick={() => onNavigateToLedger?.({ category: slice.category, range: chartView })}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 mr-2">
                    <span aria-hidden="true" className="size-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryChartColor(slice.category) }} />
                    <span className="font-bold text-foreground truncate">{slice.category}</span>
                  </span>
                  <span className="text-foreground/90 font-extrabold shrink-0">
                    {formatSensitive(slice.amount)} ({(slice.percentage * 100).toFixed(0)}%)
                  </span>
                </motion.button>
              ))}
            </div>
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

function getDoughnutPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180
  const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180
  const x1Outer = cx + rOuter * Math.cos(startAngleRad)
  const y1Outer = cy + rOuter * Math.sin(startAngleRad)
  const x2Outer = cx + rOuter * Math.cos(endAngleRad)
  const y2Outer = cy + rOuter * Math.sin(endAngleRad)
  const x1Inner = cx + rInner * Math.cos(startAngleRad)
  const y1Inner = cy + rInner * Math.sin(startAngleRad)
  const x2Inner = cx + rInner * Math.cos(endAngleRad)
  const y2Inner = cy + rInner * Math.sin(endAngleRad)
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0

  return `M ${x1Outer} ${y1Outer} A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer} L ${x2Inner} ${y2Inner} A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner} Z`
}
