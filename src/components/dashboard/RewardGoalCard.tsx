import type { WishlistItem } from '../../types'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { RewardIcon } from '../semanticIcons'
import { AmountText } from '../ui/AmountText'
import { AnimatedNumber } from '../ui/AnimatedNumber'
import { Badge } from '../ui/Badge'
import { InteractiveCard } from '../ui/InteractiveCard'
import { ProgressRing } from '../ui/ProgressRing'

export interface WishlistGoal {
  item: WishlistItem
  rewardsBalance: number
  pct: number
  canAfford: boolean
}

interface RewardGoalCardProps {
  goal: WishlistGoal
  currency: string
  hideSensitive: boolean
  onOpen: () => void
}

/**
 * The reward the Rewards bucket is saving towards, as one ring: how much of its price the free
 * Rewards money already covers. The percentage stays visible in sensitive mode -- it is a ratio --
 * while both amounts are masked.
 */
export function RewardGoalCard({ goal, currency, hideSensitive, onOpen }: RewardGoalCardProps) {
  const color = getCategoryChartColor('Rewards')
  return (
    <InteractiveCard onClick={onOpen} className="p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-label text-muted-foreground">Reward: {goal.item.name}</span>
        {goal.canAfford && <Badge tone="success">Ready to buy</Badge>}
      </div>
      <div className="mt-4 flex items-center gap-4">
        <ProgressRing percent={goal.pct} size={64} thickness={6} color={color} label={`${goal.item.name} funded`}>
          <RewardIcon className="size-5" style={{ color }} aria-hidden="true" />
        </ProgressRing>
        <div className="min-w-0">
          <AnimatedNumber
            value={goal.pct}
            formatFn={value => `${value.toFixed(0)}%`}
            className="block text-title text-foreground tabular-nums"
          />
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 text-caption text-muted-foreground">
            <AmountText value={goal.rewardsBalance} currency={currency} isMasked={hideSensitive} className="font-medium text-foreground" />
            <span>saved of</span>
            <AmountText value={goal.item.price} currency={currency} isMasked={hideSensitive} />
          </p>
        </div>
      </div>
    </InteractiveCard>
  )
}
