import { m, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ChevronRight, PieChart } from 'lucide-react'
import type { AppTab, InvestmentAllocationOverview } from '../../types'
import { Button } from '../ui/Button'

interface InvestmentPlanExceptionCardProps {
  allocation: InvestmentAllocationOverview | null
  onNavigate: (tab: AppTab) => void
}

export function InvestmentPlanExceptionCard({
  allocation,
  onNavigate,
}: InvestmentPlanExceptionCardProps) {
  const reduceMotion = useReducedMotion()
  if (!allocation || (allocation.status !== 'Alert' && allocation.status !== 'Incomplete')) return null

  const incomplete = allocation.status === 'Incomplete'
  const alertSleeve = allocation.sleeves
    .filter(value => value.status === 'Alert')
    .sort((a, b) => Math.abs(b.driftPercentagePoints ?? 0) - Math.abs(a.driftPercentagePoints ?? 0))[0]
  const open = () => {
    if (incomplete) {
      const next = new URL(window.location.href)
      next.searchParams.set('section', 'investment-plan')
      window.history.replaceState(window.history.state, '', next)
      onNavigate('settings')
    } else {
      onNavigate('investments')
    }
  }

  return (
    <m.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="investment-plan-exception"
      className="app-panel rounded-2xl border border-amber-500/30 bg-card/92 p-4 sm:p-5 shadow-xs"
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/15 text-amber-600 dark:text-amber-400">
            {incomplete ? <PieChart className="size-5" /> : <AlertTriangle className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="investment-plan-exception" className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {incomplete ? 'Investment plan needs setup' : 'Investment allocation needs attention'}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {incomplete
                ? allocation.incompleteReasons[0] ?? 'Classify every open investment to complete its valuation.'
                : `${alertSleeve?.label ?? 'A basket'} is ${Math.abs(alertSleeve?.driftPercentagePoints ?? 0).toFixed(1)} points from target.`}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={open}
          className="w-full justify-center sm:w-auto shrink-0 border-amber-500/30 bg-card/60 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
        >
          {incomplete ? 'Finish setup' : 'Review plan'}
          <ChevronRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </m.section>
  )
}
