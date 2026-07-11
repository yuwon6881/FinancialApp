import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { DashboardData, TrendPoint } from '../../types'
import { formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { useAppContext } from '../../contexts/AppContext'

type TrendRange = '3month' | '6month' | 'yearly'

const chartPosition = (points: TrendPoint[], index: number) => {
  const min = Math.min(...points.map(point => point.balance), 0)
  const max = Math.max(...points.map(point => point.balance), 1000)
  const x = 15 + (index / (points.length - 1)) * 470
  const y = 105 - ((points[index].balance - min) / (max - min || 1)) * 90
  return { x, y, left: (x / 500) * 100, top: (y / 120) * 75 + 25 }
}

export function TrendLineChart({ dashboardData, growthBalance }: { dashboardData: DashboardData | null; growthBalance: number }) {
  const { hideSensitive, currency, formatSensitive } = useAppContext()
  const [range, setRange] = useState<TrendRange>('yearly')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const points = range === '3month'
    ? dashboardData?.last3TrendPoints || []
    : range === '6month'
      ? dashboardData?.last6TrendPoints || []
      : dashboardData?.trendPoints || []
  const polyline = useMemo(() => points.length < 2
    ? ''
    : points.map((_, index) => {
      const position = chartPosition(points, index)
      return `${position.x},${position.y}`
    }).join(' '), [points])

  const selectNearest = (clientX: number) => {
    if (!svgRef.current || points.length < 2) return
    const rect = svgRef.current.getBoundingClientRect()
    const index = Math.round(((clientX - rect.left) / rect.width) * (points.length - 1))
    setHoveredIndex(Math.max(0, Math.min(points.length - 1, index)))
  }

  return (
    <div className="app-panel p-6 rounded-2xl bg-card/92 border border-border/60 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Total Growth Deposited</h3>
            <p className="text-[10px] text-muted-foreground">Cumulative Growth category investment balance</p>
          </div>
          <TrendingUp className="size-4 text-blue-500" />
        </div>
        <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 text-[9px] mb-3 w-fit">
          {(['3month', '6month', 'yearly'] as const).map(value => (
            <button key={value} onClick={() => setRange(value)} className={`px-2 py-0.5 rounded-md font-bold ${range === value ? 'bg-background shadow-xs' : 'text-muted-foreground'}`}>
              {value === '3month' ? '3M' : value === '6month' ? '6M' : 'Year'}
            </button>
          ))}
        </div>
        <div
          onMouseMove={event => selectNearest(event.clientX)}
          onMouseLeave={() => setHoveredIndex(null)}
          onTouchStart={event => selectNearest(event.touches[0].clientX)}
          onTouchMove={event => selectNearest(event.touches[0].clientX)}
          className={`h-40 flex flex-col justify-end w-full relative mt-2 ${hideSensitive ? 'blur-xs pointer-events-none' : ''}`}
        >
          {polyline ? (
            <>
              <svg ref={svgRef} className="w-full h-[120px] overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                <defs><linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
                <motion.path d={`M 15,105 L ${polyline} L 485,105 Z`} fill="url(#growthGradient)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                <motion.polyline key={range} fill="none" stroke="var(--color-chart-line, #4f46e5)" strokeWidth="2.5" points={polyline} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />
              </svg>
              {points.map((_, index) => {
                const position = chartPosition(points, index)
                return <span key={index} className="absolute size-1.5 rounded-full bg-blue-500/50" style={{ left: `calc(${position.left}% - 3px)`, top: `calc(${position.top}% - 3px)` }} />
              })}
              {hoveredIndex !== null && points[hoveredIndex] && (() => {
                const point = points[hoveredIndex]
                const position = chartPosition(points, hoveredIndex)
                return <div className="absolute z-20 bg-card border rounded-xl p-1.5 shadow-xl text-center" style={{ left: `clamp(4px, calc(${position.left}% - 50px), calc(100% - 104px))`, top: `clamp(4px, calc(${position.top}% - 46px), calc(100% - 40px))`, width: 100 }}><b className="block text-[9px]">{point.month}</b><span className="text-[10px] font-black text-blue-500">{hideSensitive ? SENSITIVE_AMOUNT_MASK : formatCurrencyVal(point.balance, currency)}</span></div>
              })()}
            </>
          ) : <div className="text-xs text-muted-foreground pb-12 text-center">Calculating trend points...</div>}
        </div>
        <div className="flex justify-between px-[3%] mt-1">{points.map((point, index) => <span key={index} className="text-[9px] text-muted-foreground font-bold w-8">{point.month}</span>)}</div>
      </div>
      <div className="border-t border-border/50 pt-3 mt-3 flex justify-between text-[10px] text-muted-foreground">
        <span>{range === '3month' ? 'Last 3 cycles' : range === '6month' ? 'Last 6 cycles' : `${dashboardData?.setting.selectedYear || new Date().getFullYear()} full year`}</span>
        <span>Growth Savings: {formatSensitive(growthBalance)}</span>
      </div>
    </div>
  )
}
