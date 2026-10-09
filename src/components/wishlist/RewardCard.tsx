import React from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { RewardIcon } from '../semanticIcons'
import type { WishlistItem } from '../../types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { DetailDisclosure } from '../ui/DetailDisclosure'
import { Meter } from '../ui/Meter'
import { OverflowMenu } from '../ui/OverflowMenu'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { useDetailDisclosure } from '../../lib/useDetailDisclosure'

interface RewardCardProps {
  item: WishlistItem
  fullWidth?: boolean
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

export const RewardCard: React.FC<RewardCardProps> = ({
  item,
  fullWidth = false,
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
  const detail = useDetailDisclosure()

  return (
    <Card
      id={elementId}
      className={`${fullWidth ? 'w-full' : 'w-[calc(100vw-3.5rem)] shrink-0 snap-start sm:w-full sm:min-w-0'} flex flex-col gap-3.5 p-5 transition-colors duration-300 ${
        isFocused ? 'border-pink-500/50 ring-1 ring-pink-500/20' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {/* A dot, not a star. The commitment card beside this one already says "this row is
              special" with a coloured dot, and two different glyphs for the same idea is most of
              why the two rails read as parts of different pages. */}
          {isFocused && (
            <span className="size-2 shrink-0 rounded-full bg-pink-500" aria-label="Focused reward" />
          )}
          <h4 className="min-w-0 flex-1 truncate text-subsection text-foreground">{item.name}</h4>
          <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={item.isPendingSync} entityLabel="item" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-title text-foreground tabular-nums">{formatSensitive(item.price)}</span>
          <span className={`text-label font-medium ${canAfford ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        {/* pink is the Rewards bucket colour everywhere else in the app — its ledger badge, its
            chart slice, its filter chip. This bar was blue, which is what Income and Transfer are
            painted with, so the one page about Rewards money was the one page not using its colour. */}
        <Meter
          className="mt-1.5"
          percent={pct}
          tone={canAfford ? 'bg-emerald-500' : 'bg-pink-500'}
          label={canAfford
            ? 'Enough free rewards to claim this'
            : `${pct.toFixed(0)}% of this reward covered by free rewards`}
        />
      </div>

      <p className={`text-label font-medium ${canAfford ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
        {canAfford
          ? 'Ready to claim'
          : <>Need {formatSensitive(item.price - claimableBalance)} more</>}
      </p>

      {canAfford && item.price > freeAfterGoalPace && (
        <p className="text-label text-muted-foreground">
          Buying this leaves your commitments <span className="font-semibold text-amber-700 dark:text-amber-300">{formatSensitive(goalPaceShortfall)}</span> short this cycle.
        </p>
      )}

      <DetailDisclosure
        label="Details"
        open={detail.isOpen}
        onOpenChange={detail.setOpen}
        expandedFrom="lg"
      >
        {/* One row per line on compact, label and figure on the same line — the same contract the
            commitment card's detail grid uses, and for the same reason: two columns inside a
            phone-width card wrapped "Free after commitments" into a stack of single words. */}
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-label sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <dt className="text-muted-foreground">Priority</dt>
            <dd className="font-medium text-foreground tabular-nums">{item.priority}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <dt className="text-muted-foreground">Free rewards</dt>
            <dd className="font-medium text-foreground tabular-nums">{formatSensitive(claimableBalance)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:block">
            <dt className="text-muted-foreground">Free after commitments</dt>
            <dd className="font-medium text-foreground tabular-nums">{formatSensitive(freeAfterGoalPace)}</dd>
          </div>
          {timeline && (
            <div className="flex items-baseline justify-between gap-2 sm:block">
              <dt className="text-muted-foreground">Affordable in</dt>
              <dd className="font-medium text-foreground tabular-nums">{timeline}</dd>
            </div>
          )}
        </dl>
      </DetailDisclosure>

      <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3">
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => onClaim(item)}
          disabled={!canAfford || isBusy || hideSensitive}
          title={canAfford ? 'Claim this reward and log it to your ledger' : 'Not enough free rewards yet'}
        >
          Claim
        </Button>
        <OverflowMenu
          className="ml-auto"
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
    </Card>
  )
}
