import type { ReactNode } from 'react'
import type { WishlistItem } from '../../types'
import { Plus } from 'lucide-react'
import { RewardIcon } from '../semanticIcons'
import { Button } from '../ui/Button'
import { HorizontalRail } from '../ui/HorizontalRail'
import { RewardCard } from './RewardCard'

interface RewardsSectionProps {
  items: WishlistItem[]
  activeItem?: WishlistItem
  affordableCount: number
  claimableBalance: number
  freeAfterGoalPace: number
  formatSensitive: (value: number) => ReactNode
  hideSensitive: boolean
  rewardTimeline: (price: number) => string
  isSyncing: (id: number) => boolean
  isDeleting: (id: number) => boolean
  onAdd: () => void
  onClaim: (item: WishlistItem) => void
  onFocus: (item: WishlistItem) => void
  onEdit: (item: WishlistItem) => void
  onDelete: (id: number) => void
}

export function RewardsSection(props: RewardsSectionProps) {
  return (
    <section aria-labelledby="commitments-rewards-rewards-heading" className="app-panel space-y-3 rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-border/60 sm:bg-card/92 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="commitments-rewards-rewards-heading" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <RewardIcon className="size-4 text-accent-ink" aria-hidden />
            Rewards
            {props.affordableCount > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                {props.affordableCount} claimable
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            From your {props.formatSensitive(props.claimableBalance)} free rewards
            {!props.activeItem || props.claimableBalance >= props.activeItem.price
              ? null
              : <> · {props.activeItem.name} in {props.rewardTimeline(props.activeItem.price)}</>}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="size-11 shrink-0 p-0 sm:size-auto sm:px-3 sm:py-1.5" onClick={props.onAdd} disabled={props.hideSensitive} title={props.hideSensitive ? 'Unhide balances to add a reward' : undefined} aria-label="Add reward">
          <Plus className="size-3" aria-hidden /> <span className="hidden sm:inline">Add reward</span>
        </Button>
      </div>

      {props.items.length > 0 ? (
        <HorizontalRail label="Rewards" showControls>
          {props.items.map(item => (
            <RewardCard
              key={item.id}
              item={item}
              isFocused={props.activeItem?.id === item.id}
              claimableBalance={props.claimableBalance}
              freeAfterGoalPace={props.freeAfterGoalPace}
              formatSensitive={props.formatSensitive}
              hideSensitive={props.hideSensitive}
              isSyncing={props.isSyncing(item.id)}
              isDeleting={props.isDeleting(item.id)}
              onClaim={props.onClaim}
              onFocus={props.onFocus}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              fullWidth={props.items.length === 1}
            />
          ))}
        </HorizontalRail>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">No rewards yet. Add one to save toward.</p>
        </div>
      )}
    </section>
  )
}
