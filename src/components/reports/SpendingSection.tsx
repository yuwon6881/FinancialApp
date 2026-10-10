import type { ReactNode } from 'react'
import type { AppTab, CategoryLimitProgress, DashboardData } from '../../types'
import type { AppNavigationOptions } from '../../lib/appLocation'
import type { NavigateToLedgerOptions } from '../dashboard/types'
import { cn } from '../../lib/utils'
import { CategoryLimitPerformance } from '../dashboard/CategoryLimitPerformance'
import { DoughnutChart } from '../dashboard/DoughnutChart'
import { SectionHeader } from '../ui/SectionHeader'
import { panelClass } from '../ui/panelStyles'

interface SpendingSectionProps {
  dashboardData: DashboardData | null
  selectedYear: number
  limits: CategoryLimitProgress[]
  formatSensitive: (value: number) => ReactNode
  onNavigateToLedger?: (options: NavigateToLedgerOptions) => void
  onNavigate?: (tab: AppTab, options?: AppNavigationOptions) => void
  /** A category limit arrived at from another tab. */
  highlightedCategory?: string | null
}

/**
 * "Where it went": the outflow breakdown and the category limits read as one answer. Side by side
 * once the panel is wide enough to give each half a real column, stacked above a hairline below.
 */
export function SpendingSection({
  dashboardData,
  selectedYear,
  limits,
  formatSensitive,
  onNavigateToLedger,
  onNavigate,
  highlightedCategory = null,
}: SpendingSectionProps) {
  return (
    <section id="report-section-spending" aria-labelledby="report-spending-heading" className="@container space-y-3">
      <SectionHeader
        titleId="report-spending-heading"
        title="Where it went"
        description="Outflow by category, and how each category is pacing against its limit."
      />
      <div
        className={cn(
          panelClass,
          'grid min-w-0 gap-6 p-4 sm:p-5 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @4xl:gap-0',
        )}
      >
        <div className="min-w-0 @4xl:pr-6">
          <DoughnutChart
            dashboardData={dashboardData}
            selectedYear={selectedYear}
            onNavigateToLedger={onNavigateToLedger}
          />
        </div>
        <div className="min-w-0 border-t border-border/60 pt-5 @4xl:border-l @4xl:border-t-0 @4xl:pl-6 @4xl:pt-0">
          <div id="report-section-category-limits" className="@container min-w-0 rounded-control">
            <CategoryLimitPerformance
              items={limits}
              formatSensitive={formatSensitive}
              onNavigateToLedger={onNavigateToLedger}
              onNavigate={onNavigate}
              revealCategory={highlightedCategory}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
