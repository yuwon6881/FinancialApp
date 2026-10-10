import { Plus } from 'lucide-react'
import type { LedgerAccount } from '../../../types'
import type { AccountBillRoster as AccountBillRosterType } from '../../../lib/accountBillRoster'
import { formatCurrencyVal } from '../../../lib/utils'
import { splitBucketCards } from '../../../lib/creditCards'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import { cn } from '../../../lib/utils'
import { panelClass } from '../../ui/panelStyles'
import { Button } from '../../ui/Button'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { AccountRow } from './AccountRow'
import { DataTablePagination } from '../../ui/DataTable'
import { useClientPagination } from '../../ui/useClientPagination'
import { EmptyState } from '../../ui/EmptyState'

export interface BucketAccountGroupProps {
  bucket: LedgerAccount['bucket']
  description: string
  accounts: LedgerAccount[]
  allBucketAccounts: LedgerAccount[]
  currency: string
  hideSensitive: boolean
  disabled?: boolean
  isDeleting: (id: string) => boolean
  isSyncing: (id: string) => boolean
  billRosters?: Map<string, AccountBillRosterType>
  onAdd: (bucket: LedgerAccount['bucket']) => void
  onEdit: (account: LedgerAccount) => void
  onDelete: (id: string) => void
  onMoveMoney: (bucket: LedgerAccount['bucket']) => void
  onNavigateToRecurring?: (recurringId: string) => void
  onClearCard?: (card: LedgerAccount) => void
  searchQuery?: string
}

export function BucketAccountGroup({
  bucket,
  description,
  accounts,
  allBucketAccounts,
  currency,
  hideSensitive,
  disabled = false,
  isDeleting,
  isSyncing,
  billRosters,
  onAdd,
  onEdit,
  onDelete,
  onMoveMoney,
  onNavigateToRecurring,
  onClearCard,
  searchQuery,
}: BucketAccountGroupProps) {
  const pagination = useClientPagination(accounts.length, 10)
  const visibleAccounts = accounts.slice(pagination.start, pagination.end)
  const bucketColor = getCategoryChartColor(bucket)
  const openCount = allBucketAccounts.filter(account => !account.isArchived).length
  const totalBalance = allBucketAccounts.reduce((sum, account) => sum + account.remaining, 0)
  const hasAnyAccounts = allBucketAccounts.length > 0
  const cardSplit = splitBucketCards(allBucketAccounts)

  return (
    <div
      id={`bucket-account-group-${bucket}`}
      className={cn(panelClass, 'relative flex flex-col justify-between p-4 sm:p-5', !hasAnyAccounts && 'border-dashed')}
    >
      <div className="space-y-4">
        {/* Bucket header: which bucket, what it is for, and what it holds. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: bucketColor }} />
              <span className="text-subsection text-foreground">{bucket}</span>
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-label text-muted-foreground">
              <span>{description}</span>
              <span aria-hidden="true">·</span>
              <span>{openCount ? `${openCount} open ${openCount === 1 ? 'account' : 'accounts'}` : 'Empty'}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="sr-only">Bucket total</span>
            <SensitiveAmount
              value={totalBalance}
              isMasked={hideSensitive}
              formatFn={value => formatCurrencyVal(value, currency)}
              className="block text-title text-foreground tabular-nums"
            />
          </div>
        </div>

        {/* The total already counts card debt; this line shows the two halves so the total
            is never mistaken for cash in hand. */}
        {cardSplit && (
          <div className="-mt-2 space-y-1">
            <p className="text-caption text-muted-foreground">
              <SensitiveAmount value={cardSplit.cash} isMasked={hideSensitive} formatFn={value => formatCurrencyVal(value, currency)} className="font-semibold text-foreground" />
              {' in accounts · '}
              <SensitiveAmount value={cardSplit.owed} isMasked={hideSensitive} formatFn={value => formatCurrencyVal(value, currency)} className="font-semibold text-foreground" />
              {' owed on cards'}
            </p>
            {cardSplit.isShort && !hideSensitive && (
              <p className="text-caption font-medium text-amber-700 dark:text-amber-300">
                Your {bucket} accounts can't pay off its cards in full today.
              </p>
            )}
          </div>
        )}

        {/* Account list or empty state */}
        {!hasAnyAccounts ? (
          <EmptyState
            density="compact"
            title={`No accounts added for ${bucket} yet.`}
            actions={(
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onAdd(bucket)}
                disabled={disabled || hideSensitive}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add the first account
              </Button>
            )}
          />
        ) : accounts.length === 0 ? (
          <div className="rounded-control bg-surface-2/60 px-4 py-4 text-center text-label text-muted-foreground">
            {searchQuery ? `No accounts in ${bucket} match "${searchQuery}".` : `No accounts in ${bucket}.`}
          </div>
        ) : (
          <div className="divide-y divide-border/60 border-t border-border/60">
            {visibleAccounts.map(account => (
              <AccountRow
                key={account.id}
                account={account}
                currency={currency}
                hideSensitive={hideSensitive}
                disabled={disabled}
                isDeleting={isDeleting(account.id)}
                isSyncing={isSyncing(account.id)}
                roster={billRosters?.get(account.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                onNavigateToRecurring={onNavigateToRecurring}
                onClearCard={onClearCard}
              />
            ))}
            {accounts.length > pagination.pageSize && (
              <DataTablePagination
                centerOnMobile
                currentPage={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={accounts.length}
                totalPages={pagination.totalPages}
                showPageSize={false}
                onPageChange={pagination.setPage}
                onPageSizeChange={() => undefined}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer action row */}
      {hasAnyAccounts && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            onClick={() => onAdd(bucket)}
            disabled={disabled || hideSensitive}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add account
          </Button>
          {openCount >= 2 && (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => onMoveMoney(bucket)}
              disabled={disabled || hideSensitive}
            >
              Update balances
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
