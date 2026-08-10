import React from 'react'
import { Edit2, MoreHorizontal, Target, Trash2, X } from 'lucide-react'
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
  const [showManage, setShowManage] = React.useState(false)
  // Same rule as SavingsGoalCard: a row on its way out must not keep offering Edit and Delete.
  React.useEffect(() => {
    if (isBusy) setShowManage(false)
  }, [isBusy])

  return (
    <Card
      className={`snap-start shrink-0 w-[80vw] sm:w-[22rem] flex flex-col gap-3 p-4 transition-colors duration-300 ${
        isFocused ? 'border-pink-500/50 ring-1 ring-pink-500/20' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {/* A dot, not a star. The commitment card beside this one already says "this row is
              special" with a coloured dot, and two different glyphs for the same idea is most of
              why the two rails read as parts of different pages. */}
          {isFocused && (
            <span className="size-1.5 shrink-0 rounded-full bg-pink-500" aria-label="Focused reward" />
          )}
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
          <span className={`text-xs font-bold ${canAfford ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        {/* pink is the Rewards bucket colour everywhere else in the app — its ledger badge, its
            chart slice, its filter chip. This bar was blue, which is what Income and Transfer are
            painted with, so the one page about Rewards money was the one page not using its colour. */}
        <div className="mt-1.5 w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${canAfford ? 'bg-emerald-500' : 'bg-pink-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className={`text-xs font-bold ${canAfford ? 'text-emerald-500' : 'text-muted-foreground'}`}>
        {canAfford
          ? 'Ready to claim'
          : <>Need {formatSensitive(item.price - claimableBalance)} more</>}
      </p>

      {/* Management *replaces* the claim actions, exactly as it does on SavingsGoalCard. This row
          used to carry a permanently visible red Delete beside a text Edit — the loudest thing on
          the page, on a card whose neighbour in the next rail keeps both behind a toggle. */}
      <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-border/30 pt-3">
        {showManage ? (
          <React.Fragment key="manage-actions">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
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
              className="shrink-0"
              onClick={() => onDelete(item.id)}
              disabled={isBusy || hideSensitive}
              aria-label={`Delete ${item.name}`}
              title={hideSensitive ? 'Unhide balances to delete' : 'Delete reward'}
            >
              <Trash2 className="size-3.5 shrink-0" /> Delete
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setShowManage(false)}
              aria-expanded
              aria-label={`Hide edit and delete for ${item.name}`}
              title="Back"
            >
              <X className="size-3.5" />
            </Button>
          </React.Fragment>
        ) : (
          <React.Fragment key="primary-actions">
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => onClaim(item)}
              disabled={!canAfford || isBusy || hideSensitive}
              title={canAfford ? 'Claim this reward and log it to your ledger' : 'Not enough free rewards yet'}
            >
              Claim
            </Button>
            {!isFocused && (
              <Button
                variant="secondary"
                size="icon"
                className="shrink-0"
                onClick={() => onFocus(item)}
                disabled={isBusy || hideSensitive}
                aria-label={`Focus ${item.name}`}
                title="Save toward this one next"
              >
                <Target className="size-3.5" />
              </Button>
            )}
            {/* Swipe-to-reveal is not an option here either: the card lives in a horizontally
                scrolling rail, so a horizontal drag on it belongs to the rail. */}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0"
              onClick={() => setShowManage(true)}
              aria-expanded={false}
              aria-label={`Edit or delete ${item.name}`}
              title="Edit or delete"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </React.Fragment>
        )}
      </div>
    </Card>
  )
}
