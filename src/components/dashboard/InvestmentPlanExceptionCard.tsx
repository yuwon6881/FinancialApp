import { AlertTriangle, ChevronRight, PieChart } from 'lucide-react'
import type { AppNavigationOptions } from '../../lib/appLocation'
import type { AppTab, InvestmentAllocationOverview } from '../../types'
import { Button } from '../ui/Button'
import { NoticeCard } from './NoticeCard'

interface InvestmentPlanExceptionCardProps {
  allocation: InvestmentAllocationOverview | null
  onNavigate: (tab: AppTab, options?: AppNavigationOptions) => void
}

export function InvestmentPlanExceptionCard({
  allocation,
  onNavigate,
}: InvestmentPlanExceptionCardProps) {
  if (!allocation || (allocation.status !== 'Alert' && allocation.status !== 'Incomplete')) return null

  const incomplete = allocation.status === 'Incomplete'
  const alertSleeve = allocation.sleeves
    .filter(value => value.status === 'Alert')
    .sort((a, b) => Math.abs(b.driftPercentagePoints ?? 0) - Math.abs(a.driftPercentagePoints ?? 0))[0]
  const open = () => {
    if (incomplete) {
      onNavigate('settings', { search: { section: 'investment-plan' } })
    } else {
      onNavigate('investments')
    }
  }

  return (
    <NoticeCard
      tone="attention"
      icon={incomplete ? <PieChart /> : <AlertTriangle />}
      titleId="investment-plan-exception"
      title={incomplete ? 'Investment plan needs setup' : 'Investment allocation needs attention'}
      description={incomplete
        ? allocation.incompleteReasons[0] ?? 'Classify every open investment to complete its valuation.'
        : `${alertSleeve?.label ?? 'A basket'} is ${Math.abs(alertSleeve?.driftPercentagePoints ?? 0).toFixed(1)} points from target.`}
      actions={(
        <Button variant="secondary" size="sm" onClick={open}>
          {incomplete ? 'Finish setup' : 'Review plan'}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    />
  )
}
