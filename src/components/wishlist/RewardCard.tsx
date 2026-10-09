import React from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { RewardIcon } from '../semanticIcons'
import type { WishlistItem } from '../../types'
import { Button } from '../ui/Button'
import { Meter } from '../ui/Meter'
import { OverflowMenu } from '../ui/OverflowMenu'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { cn } from '../../lib/utils'

interface RewardCardProps {
  item: WishlistItem
  /** DOM id the shared highlight helper scrolls to when search jumps to this reward. */
  elementId?: string
  /** The one reward being saved toward: pinned leftmost and visually lifted out of the row. */
  isFocused: boolean
  /**
   * Free-to-spend rewards. Progress is measured against this rather than the whole Rewards balance,
   * because committed money cannot buy a reward.
   */
  claimableBalance: number
  /** Free rewards after reserving the active goals' outstanding share for this cycle. */
  freeAfterGoalPace: number
  /** How long until this reward is affordable, when it is the focused one. */
  timeline?: string | null
  formatSensitive: (value: number) => React.ReactNode
  hideSensitive: boolean
  isSyncing: boolean
  isDeleting: boolean
  onClaim: (item: WishlistItem) => void
  onFocus: (item: WishlistItem) => void
  onEdit: (item: WishlistItem) => void
  onDelete: (id: number) => void
}

const PRIORITY_TONE: Record<string, string> = {
  High: 'bg-pink-500/12 text-pink-600 dark:text-pink-300',
  Medium: 'bg-surface-3 text-foreground',
  Low: 'bg-surface-2 text-muted-foreground dark:bg-surface-3',
}

/**
 * One reward as a tile of the wish grid: what it is, what it costs, how much of it the free rewards
 * money already covers, and Claim once it is all there. The pool-wide figures (free rewards, what is
 * left after commitments) are said once above the grid rather than on every tile.
 */
export const RewardCard: React.FC<RewardCardProps> = ({
  item,
  elementId,
  isFocused,
  claimableBalance,
  freeAfterGoalPace,
  timeline,
  formatSensitive,
  hideSensitive,
  isSyncing,
  isDeleting,
  onClaim,
  onFocus,
  onEdit,
  onDelete,
}) => {
  const pct = item.price > 0
    ? Math.max(0, Math.min(100, (claimableBalance / item.price) * 100))
    : 0
  const canAfford = claimableBalance >= item.price
  const goalPaceShortfall = Math.max(0, item.price - freeAfterGoalPace)
  const isBusy = isSyncing || isDeleting || item.isPendingSync === true

  return (
    <article
      id={elementId}
      className={cn(
        'flex min-w-0 flex-col rounded-panel border bg-card p-3.5 shadow-xs transition-colors duration-300 sm:p-4',
        isFocused ? 'border-pink-500/50 ring-1 ring-pink-500/20' : 'border-border/70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-caption font-medium', PRIORITY_TONE[item.priority] ?? PRIORITY_TONE.Low)}>
          {isFocused ? 'Saving for this' : item.priority}
          <span className="sr-only"> priority</span>
        </span>
        <OverflowMenu
          className="-mr-2 -mt-1.5"
          entityLabel={item.name}
          disabled={isBusy}
          items={[
            ...(isFocused ? [] : [{
              label: 'Save toward this next',
              icon: RewardIcon,
              onSelect: () => onFocus(item),
              disabled: hideSensitive,
              hint: 'Unhide balances to change focus',
            }]),
            {
              label: 'Edit',
              icon: Edit2,
              onSelect: () => onEdit(item),
              disabled: hideSensitive,
              hint: 'Unhide balances to edit',
            },
            {
              label: 'Delete',
              icon: Trash2,
              tone: 'danger' as const,
              onSelect: () => onDelete(item.id),
              disabled: hideSensitive,
              hint: 'Unhide balances to delete',
            },
          ]}
        />
      </div>

      <h4 className="mt-2 flex min-w-0 items-start gap-1.5 text-body font-medium text-foreground">
        {isFocused && <span className="sr-only">Focused reward: </span>}
        <span className="line-clamp-2 min-w-0 break-words">{item.name}</span>
        <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={item.isPendingSync} entityLabel="item" />
      </h4>
      <p className="mt-1 text-title text-foreground tabular-nums">{formatSensitive(item.price)}</p>

      <div className="mt-auto pt-3">
        {/* Pink is the Rewards bucket colour everywhere else in the app; the bar turns green once the
            free money covers the whole price. */}
        <Meter
          percent={pct}
          tone={canAfford ? 'bg-emerald-500' : 'bg-pink-500'}
          label={canAfford
            ? 'Enough free rewards to claim this'
            : `${pct.toFixed(0)}% of this reward covered by free rewards`}
        />
        <p className={cn('mt-1.5 text-caption font-medium', canAfford ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground')}>
          {canAfford
            ? 'Ready to claim'
            : <>Need {formatSensitive(item.price - claimableBalance)} more</>}
        </p>
        {!canAfford && timeline && (
          <p className="text-caption text-muted-foreground" title={timeline}>
            {/* The date in brackets is for the tooltip; the tile only has room for the span. */}
            {timeline.replace(/ \(.*\)$/, '').replace(/^about/, 'In about')}
          </p>
        )}
        {canAfford && item.price > freeAfterGoalPace && (
          <p className="mt-0.5 text-caption text-amber-700 dark:text-amber-300" title="Buying this leaves your commitments short of what they need this cycle">
            Leaves commitments <span className="font-semibold tabular-nums">{formatSensitive(goalPaceShortfall)}</span> short
          </p>
        )}
        <Button
          size="sm"
          variant={canAfford ? 'primary' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => onClaim(item)}
          disabled={!canAfford || isBusy || hideSensitive}
          title={canAfford ? 'Claim this reward and log it to your ledger' : 'Not enough free rewards yet'}
        >
          Claim
        </Button>
      </div>
    </article>
  )
}
