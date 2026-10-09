import type { ReactNode } from 'react'
import type { WishlistItem } from '../../types'
import { Plus } from 'lucide-react'
import { RewardIcon } from '../semanticIcons'
import { Button } from '../ui/Button'
import { RewardCard } from './RewardCard'
import { DataTablePagination } from '../ui/DataTable'
import { useClientPagination } from '../ui/useClientPagination'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'

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
  const activeIndex = props.activeItem ? props.items.findIndex(item => item.id === props.activeItem?.id) : -1
  const pagination = useClientPagination(props.items.length, 9, activeIndex)
  const visibleItems = props.items.slice(pagination.start, pagination.end)
  return (
    <section aria-labelledby="commitments-rewards-rewards-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="commitments-rewards-rewards-heading" className="flex items-center gap-1.5 text-subsection text-foreground">
            <RewardIcon className="size-4 text-muted-foreground" aria-hidden />
            Rewards
            {props.affordableCount > 0 && (
              <Badge tone="success">
                {props.affordableCount} claimable
              </Badge>
            )}
          </h3>
          <p className="mt-0.5 text-label text-muted-foreground">
            From your {props.formatSensitive(props.claimableBalance)} free rewards
            {props.freeAfterGoalPace < props.claimableBalance && (
              <> · {props.formatSensitive(props.freeAfterGoalPace)} after this cycle&rsquo;s commitments</>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="size-11 shrink-0 p-0 sm:size-auto sm:px-3" onClick={props.onAdd} disabled={props.hideSensitive} title={props.hideSensitive ? 'Unhide balances to add a reward' : undefined} aria-label="Add reward">
          <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Add reward</span>
        </Button>
      </div>

      {props.items.length > 0 ? (
        /* A wish grid: two tiles a row even on a phone, so several rewards can be compared at a
           glance, where the old rail showed one card at a time. */
        <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
          {visibleItems.map(item => (
            <RewardCard
              key={item.id}
              elementId={`reward-card-${item.id}`}
              item={item}
              isFocused={props.activeItem?.id === item.id}
              timeline={props.activeItem?.id === item.id && props.claimableBalance < item.price
                ? props.rewardTimeline(item.price)
                : null}
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
            />
          ))}
        </div>
      ) : (
        <EmptyState
          density="compact"
          title="No rewards yet. Add one to save toward."
          actions={<Button variant="secondary" size="sm" onClick={props.onAdd} disabled={props.hideSensitive}>Add reward</Button>}
        />
      )}
      {props.items.length > pagination.pageSize && (
        <DataTablePagination
          centerOnMobile
          currentPage={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={props.items.length}
          totalPages={pagination.totalPages}
          showPageSize={false}
          onPageChange={pagination.setPage}
          onPageSizeChange={() => undefined}
        />
      )}
    </section>
  )
}
