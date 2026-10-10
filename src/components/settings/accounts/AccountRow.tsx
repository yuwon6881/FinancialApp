import { CircleHelp, Pencil, Trash2 } from 'lucide-react'
import type { LedgerAccount } from '../../../types'
import type { AccountBillRoster as AccountBillRosterType } from '../../../lib/accountBillRoster'
import { cardAvailableCredit, cardOwed, isCreditCard } from '../../../lib/creditCards'
import { cn, formatCurrencyVal } from '../../../lib/utils'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import { Button } from '../../ui/Button'
import { Meter } from '../../ui/Meter'
import { OverflowMenu } from '../../ui/OverflowMenu'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { AccountBillRoster } from './AccountBillRoster'
import { ACCOUNT_KIND_ICONS, ACCOUNT_KIND_LABELS } from './accountOptions'

export interface AccountRowProps {
  account: LedgerAccount
  currency: string
  hideSensitive: boolean
  disabled?: boolean
  isDeleting: boolean
  isSyncing: boolean
  roster?: AccountBillRosterType
  onEdit: (account: LedgerAccount) => void
  onDelete: (id: string) => void
  onNavigateToRecurring?: (recurringId: string) => void
  onClearCard?: (card: LedgerAccount) => void
}

export function AccountRow({
  account,
  currency,
  hideSensitive,
  disabled = false,
  isDeleting,
  isSyncing,
  roster,
  onEdit,
  onDelete,
  onNavigateToRecurring,
  onClearCard,
}: AccountRowProps) {
  const AccountIcon = ACCOUNT_KIND_ICONS[account.kind] ?? CircleHelp
  const bucketColor = getCategoryChartColor(account.bucket)
  const isCard = isCreditCard(account)
  const owed = cardOwed(account)
  const availableCredit = cardAvailableCredit(account)
  const formatMoney = (value: number) => formatCurrencyVal(value, currency)

  const balanceClass = account.isArchived ? 'text-muted-foreground' : 'text-foreground'

  return (
    <div
      id={`account-row-${account.id}`}
      className={cn('py-2 first:pt-2.5 last:pb-1', account.isArchived && 'opacity-70')}
    >
      {/* One line per account, the way a bank lists them: tapping the row edits it, the balance
          sits on the trailing edge, and the rarer actions live behind one menu. The row used to
          stack the name, the balance, Edit, Delete and a bills disclosure on separate lines,
          which made a phone screen of four accounts the height of a page. */}
      <div className="flex min-w-0 items-center gap-1">
        <Button
          type="button"
          variant="tertiary"
          onClick={() => onEdit(account)}
          disabled={disabled || isDeleting}
          aria-label={`Edit ${account.name}`}
          className="-ml-2 h-auto min-h-14 min-w-0 flex-1 justify-start gap-2.5 rounded-control px-2 py-2 text-left font-normal active:scale-100 hover:bg-surface-2/70 lg:min-h-12"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: `color-mix(in srgb, ${bucketColor} 14%, transparent)`, color: bucketColor }}
            aria-hidden="true"
          >
            <AccountIcon className="size-[1.125rem]" />
          </span>
          {/* The name keeps a floor width; on a narrow phone the balance wraps under it on the
              trailing edge rather than squeezing the name down to a letter. */}
          <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <span className="min-w-[6rem] flex-1">
            <span title={account.name} className={cn('line-clamp-2 break-words text-body font-medium', account.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground')}>
              {account.name}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
              <span className="truncate">
                {ACCOUNT_KIND_LABELS[account.kind] ?? account.kind}
                {account.isArchived && ' · Closed'}
              </span>
              <RowSyncStatus
                isDeleting={isDeleting}
                isSyncing={isSyncing}
                isPending={account.isPendingSync}
                entityLabel="account"
              />
            </span>
          </span>
          <span className="ml-auto shrink-0 text-right">
            {/* A card's balance reads as what is owed; its signed figure is still what the bucket counts. */}
            {isCard && (owed > 0 || account.remaining >= 0.005) ? (
              <>
                <SensitiveAmount
                  value={owed > 0 ? owed : account.remaining}
                  isMasked={hideSensitive}
                  formatFn={formatMoney}
                  className={cn('block text-body font-semibold tabular-nums', balanceClass)}
                />
                <span className="mt-0.5 block text-caption text-muted-foreground">{owed > 0 ? 'Owed' : 'In credit'}</span>
              </>
            ) : (
              <SensitiveAmount
                value={account.remaining}
                isMasked={hideSensitive}
                formatFn={formatMoney}
                className={cn('block text-body font-semibold tabular-nums', account.remaining < 0 && !account.isArchived ? 'text-red-600 dark:text-red-400' : balanceClass)}
              />
            )}
          </span>
          </span>
        </Button>
        <OverflowMenu
          entityLabel={account.name}
          disabled={disabled || isDeleting}
          items={[
            { label: 'Edit', icon: Pencil, onSelect: () => onEdit(account) },
            { label: 'Delete', icon: Trash2, tone: 'danger', onSelect: () => onDelete(account.id) },
          ]}
          className="shrink-0 text-muted-foreground"
        />
      </div>

      {isCard && !account.isArchived && (availableCredit !== null || (owed > 0 && onClearCard)) && (
        <div className="mt-1 space-y-2 pb-1 pl-[3.125rem] pr-1">
          {availableCredit !== null && (
          <Meter
            size="sm"
            percent={account.creditLimit ? (owed / account.creditLimit) * 100 : 0}
            tone={availableCredit < 0 ? 'bg-destructive' : 'bg-foreground/50'}
            label={`${account.name} credit used`}
            valueHidden={hideSensitive}
          />
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {availableCredit !== null && (
            <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-caption">
              <div className="flex min-w-0 gap-1.5">
                <dt className="text-muted-foreground">{availableCredit < 0 ? 'Over limit by' : 'Available credit'}</dt>
                <dd className={cn('font-semibold tabular-nums', availableCredit < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                  <SensitiveAmount value={Math.abs(availableCredit)} isMasked={hideSensitive} formatFn={formatMoney} />
                </dd>
              </div>
              <div className="flex min-w-0 gap-1.5">
                <dt className="text-muted-foreground">Credit limit</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  <SensitiveAmount value={account.creditLimit!} isMasked={hideSensitive} formatFn={formatMoney} />
                </dd>
              </div>
            </dl>
            )}
            {owed > 0 && onClearCard && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onClearCard(account)}
                disabled={disabled || isDeleting || hideSensitive}
                aria-label={`Clear ${account.name} balance`}
              >
                Clear balance
              </Button>
            )}
          </div>
        </div>
      )}

      <AccountBillRoster
        roster={roster}
        currency={currency}
        hideSensitive={hideSensitive}
        onNavigateToRecurring={onNavigateToRecurring}
      />
    </div>
  )
}
