import React from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { RewardIcon } from '../semanticIcons'
import type { WishlistItem } from '../../types'
import { Button } from '../ui/Button'
import { ProgressRing } from '../ui/ProgressRing'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { OverflowMenu } from '../ui/OverflowMenu'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { cn } from '../../lib/utils'

interface RewardCardProps {
  item: WishlistItem
  /** DOM id the shared highlight helper scrolls to when search jumps to this reward. */
  elementId?: string
  /** The one reward being saved toward: listed first and marked "Saving for this". */
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

/**
 * One reward as a row of the rewards list, built like a commitment row: a ring for how much of the
 * price the free rewards money already covers, the name over its priority, the price, and one
 * status line that says plainly whether it can be claimed -- and, when claiming would cut into
 * what this cycle's commitments still need, says that on the same line instead of under a
 * contradictory "Ready". Claim sits on that line once the money is there; the rest is in the menu.
 * The pool-wide figures (free rewards, what is left after commitments) are said once above the list.
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
  const cutsIntoCommitments = canAfford && item.price > freeAfterGoalPace
  const isBusy = isSyncing || isDeleting || item.isPendingSync === true
  // The date in brackets is for the tooltip; the row only has room for the span.
  const timelineShort = timeline ? timeline.replace(/ \(.*\)$/, '').replace(/^about/, 'in about') : null

  return (
    <li id={elementId} className="flex gap-3 py-3 pl-4 pr-2 transition-colors duration-300 sm:pl-5 sm:pr-3">
      {/* Pink is the Rewards bucket colour everywhere else in the app; the ring turns green once
          the free money covers the whole price. */}
      <ProgressRing
        percent={pct}
        size={44}
        thickness={4}
        color={canAfford ? 'var(--color-emerald-500)' : getCategoryChartColor('Rewards')}
        label={canAfford
          ? 'Enough free rewards to claim this'
          : hideSensitive ? 'Share of this reward covered by free rewards' : `${pct.toFixed(0)}% of this reward covered by free rewards`}
        valueHidden={hideSensitive}
        className="mt-0.5"
      >
        <span className="text-micro font-semibold tabular-nums text-foreground">{hideSensitive ? '•' : `${pct.toFixed(0)}%`}</span>
      </ProgressRing>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 pr-2">
          <div className="min-w-0">
            <h4 className="flex min-w-0 items-center gap-1.5 text-body font-medium text-foreground">
              {isFocused && <span className="sr-only">Focused reward: </span>}
              <span className="truncate">{item.name}</span>
              <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={item.isPendingSync} entityLabel="item" />
            </h4>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
              {isFocused && (
                <span className="shrink-0 rounded-full bg-pink-500/12 px-1.5 font-medium text-pink-700 dark:text-pink-300">Saving for this</span>
              )}
              <span className="truncate">{item.priority} priority</span>
            </p>
          </div>
          <p className="shrink-0 text-body font-semibold text-foreground tabular-nums">{formatSensitive(item.price)}</p>
        </div>

        <div className="mt-1 flex min-h-11 items-center gap-1 lg:min-h-9">
          <p
            className={cn(
              'min-w-0 flex-1 text-label',
              cutsIntoCommitments
                ? 'text-amber-700 dark:text-amber-300'
                : canAfford ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
            )}
            title={cutsIntoCommitments ? 'Buying this leaves your commitments short of what they need this cycle' : timeline ?? undefined}
          >
            {cutsIntoCommitments ? (
              <>Leaves commitments <span className="font-semibold tabular-nums">{formatSensitive(goalPaceShortfall)}</span> short</>
            ) : canAfford ? (
              'Ready to claim'
            ) : (
              <>
                Need <span className="font-medium text-foreground tabular-nums">{formatSensitive(item.price - claimableBalance)}</span> more
                {timelineShort && <> · {timelineShort}</>}
              </>
            )}
          </p>
          {canAfford && (
            <Button
              size="sm"
              variant={cutsIntoCommitments ? 'secondary' : 'primary'}
              className="shrink-0"
              onClick={() => onClaim(item)}
              disabled={isBusy || hideSensitive}
              title="Claim this reward and log it to your ledger"
            >
              Claim
            </Button>
          )}
          <OverflowMenu
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
      </div>
    </li>
  )
}
