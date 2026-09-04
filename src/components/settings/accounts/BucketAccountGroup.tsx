import { Plus } from 'lucide-react'
import type { LedgerAccount } from '../../../types'
import type { AccountBillRoster as AccountBillRosterType } from '../../../lib/accountBillRoster'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
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
  searchQuery,
}: BucketAccountGroupProps) {
  const pagination = useClientPagination(accounts.length, 10)
  const visibleAccounts = accounts.slice(pagination.start, pagination.end)
  const bucketBadgeClass = getCategoryBadgeClass(bucket)
  const openCount = allBucketAccounts.filter(account => !account.isArchived).length
  const totalBalance = allBucketAccounts.reduce((sum, account) => sum + account.remaining, 0)
  const hasAnyAccounts = allBucketAccounts.length > 0

  return (
    <div
      id={`bucket-account-group-${bucket}`}
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-background/40 p-4 sm:p-5 transition duration-150 ${
        hasAnyAccounts ? 'border-border/60' : 'border-dashed border-border/70'
      }`}
    >
      <div className="space-y-4">
        {/* Bucket header */}
        <div className="flex flex-col gap-2 border-b border-border/30 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${bucketBadgeClass}`}>
              {bucket}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">
              {openCount ? `${openCount} open ${openCount === 1 ? 'account' : 'accounts'}` : 'Empty'}
            </span>
          </div>
        </div>

        {/* Bucket total balance */}
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="text-eyebrow uppercase text-muted-foreground">
              Bucket total
            </span>
            <SensitiveAmount
              value={totalBalance}
              isMasked={hideSensitive}
              formatFn={value => formatCurrencyVal(value, currency)}
              className="mt-0.5 block text-lg font-extrabold text-foreground sm:text-xl"
            />
          </div>
        </div>

        {/* Account list or empty state */}
        {!hasAnyAccounts ? (
          <EmptyState
            density="compact"
            className="bg-card/40"
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
          <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-4 text-center text-xs text-muted-foreground">
            {searchQuery ? `No accounts in ${bucket} match "${searchQuery}".` : `No accounts in ${bucket}.`}
          </div>
        ) : (
          <div className="space-y-2">
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
              />
            ))}
            {accounts.length > pagination.pageSize && (
              <DataTablePagination
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
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/30 pt-3">
          <Button
            type="button"
            variant="secondary"
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
              variant="secondary"
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
