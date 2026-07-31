import React from 'react'
import { Edit2, PiggyBank, Star, Target, Trash2 } from 'lucide-react'
import type { WishlistItem } from '../../types'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { RowSyncStatus } from '../ui/RowSyncBadge'

interface RewardCardProps {
  item: WishlistItem
  /** The one reward being saved toward: pinned leftmost and visually lifted out of the row. */
  isFocused: boolean
  /**
   * Free-to-spend rewards. Progress is measured against this rather than the whole Rewards balance,
   * because committed money cannot buy a reward.
   */
  claimableBalance: number
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
  isFocused,
  claimableBalance,
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
  const isBusy = isSyncing || isDeleting || item.isPendingSync === true

  return (
    <Card
      className={`snap-start shrink-0 w-[22rem] flex flex-col gap-3 p-4 transition-colors duration-300 ${
        isFocused
          ? 'bg-linear-to-br from-blue-500/12 to-card border-blue-500/50 ring-1 ring-blue-500/20 shadow-md shadow-blue-500/5'
          : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {isFocused && <Star className="size-3 text-blue-500 shrink-0" aria-label="Focused reward" />}
          <h4 className="text-sm font-bold text-foreground truncate">{item.name}</h4>
          <RowSyncStatus isDeleting={isDeleting} isSyncing={isSyncing} isPending={item.isPendingSync} entityLabel="item" />
        </div>
        <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
          {item.priority} priority
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-extrabold text-foreground">{formatSensitive(item.price)}</span>
          <span className={`text-[11px] font-bold ${canAfford ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="mt-1.5 w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${canAfford ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className={`text-[11px] font-bold ${canAfford ? 'text-emerald-500' : 'text-muted-foreground'}`}>
        {canAfford
          ? 'Ready to claim'
          : <>Need {formatSensitive(item.price - claimableBalance)} more</>}
      </p>

      <div className="mt-auto flex items-center gap-1 border-t border-border/30 pt-3">
        <Button
          size="sm"
          onClick={() => onClaim(item)}
          disabled={!canAfford || isBusy || hideSensitive}
          title={canAfford ? 'Claim this reward and log it to your ledger' : 'Not enough free rewards yet'}
        >
          <PiggyBank className="size-3" /> Claim
        </Button>
        {!isFocused && (
          <Button
            variant="secondary"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onFocus(item)}
            disabled={isBusy || hideSensitive}
            aria-label={`Focus ${item.name}`}
            title="Focus this reward"
          >
            <Target className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onEdit(item)}
          disabled={isBusy || hideSensitive}
          aria-label={`Edit ${item.name}`}
          title={hideSensitive ? 'Unhide balances to edit' : 'Edit reward'}
        >
          <Edit2 className="size-3.5 shrink-0" /> Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(item.id)}
          disabled={isBusy || hideSensitive}
          aria-label={`Delete ${item.name}`}
          title={hideSensitive ? 'Unhide balances to delete' : 'Delete reward'}
        >
          <Trash2 className="size-3.5 shrink-0" /> Delete
        </Button>
      </div>
    </Card>
  )
}
