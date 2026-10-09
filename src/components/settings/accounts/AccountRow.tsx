import { CircleHelp, Pencil, Trash2 } from 'lucide-react'
import type { LedgerAccount } from '../../../types'
import type { AccountBillRoster as AccountBillRosterType } from '../../../lib/accountBillRoster'
import { cardAvailableCredit, cardOwed, isCreditCard } from '../../../lib/creditCards'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Meter } from '../../ui/Meter'
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

  return (
    <div
      id={`account-row-${account.id}`}
      className={`flex flex-col gap-2.5 py-3.5 first:pt-1 last:pb-1 ${account.isArchived ? 'opacity-70' : ''}`}
    >
      {/* Wraps on the row's own width rather than the window's. Inside a bucket card the row is
          about 300px wide at the narrow end of the expanded tier, where the media-query row put the
          name, the balance and both actions on one line: the name collapsed to a single letter with
          the balance printed against it. The name keeps a floor width, so the balance and actions
          drop to their own line instead of squeezing it out. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-[9rem] flex-1 items-center gap-3 overflow-hidden">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `color-mix(in srgb, ${bucketColor} 14%, transparent)`, color: bucketColor }}
            aria-hidden="true"
          >
            <AccountIcon className="size-[1.125rem]" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p title={account.name} className={`truncate text-body font-medium ${account.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground'}`}>
              {account.name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
              <span>{ACCOUNT_KIND_LABELS[account.kind] ?? account.kind}</span>
              {account.isArchived && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-muted-foreground">Closed</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Compact takes the whole line and spreads it: the balance is a figure, so it belongs on
            the reading edge under the account name, while Edit and Delete belong on the trailing
            edge. Bunching all three at the right left the balance floating mid-row with nothing
            under the name. From `sm:` the group hugs the trailing edge again -- there it usually
            shares a line with the name, and `ml-auto` is what keeps it off the left when a narrow
            bucket card forces it onto its own. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end">
          <div className="flex shrink-0 items-center gap-2">
            {/* A card's balance reads as what is owed; its signed figure is still what the bucket counts. */}
            {isCard && (owed > 0 || account.remaining >= 0.005) ? (
              <span className={`text-body font-semibold tabular-nums ${account.isArchived ? 'text-muted-foreground' : 'text-foreground'}`}>
                <span className="font-normal text-muted-foreground">{owed > 0 ? 'Owed ' : 'In credit '}</span>
                <SensitiveAmount value={owed > 0 ? owed : account.remaining} isMasked={hideSensitive} formatFn={formatMoney} />
              </span>
            ) : (
              <SensitiveAmount
                value={account.remaining}
                isMasked={hideSensitive}
                formatFn={formatMoney}
                className={`text-body font-semibold tabular-nums ${account.isArchived ? 'text-muted-foreground' : 'text-foreground'}`}
              />
            )}
            <RowSyncStatus
              isDeleting={isDeleting}
              isSyncing={isSyncing}
              isPending={account.isPendingSync}
              entityLabel="account"
            />
          </div>

          {/* A card's extra action can push the buttons onto their own line; ml-auto keeps them on
              the trailing edge there instead of stranding them on the left. */}
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5">
            {isCard && owed > 0 && !account.isArchived && onClearCard && (
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
            <IconButton
              type="button"
              onClick={() => onEdit(account)}
              disabled={disabled || isDeleting}
              label={`Edit ${account.name}`}
              tooltip="Edit"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              type="button"
              onClick={() => onDelete(account.id)}
              disabled={disabled || isDeleting}
              label={`Delete ${account.name}`}
              tooltip="Delete"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>

      {isCard && availableCredit !== null && !account.isArchived && (
        <div className="space-y-2 rounded-control bg-surface-2/60 px-3.5 py-3">
        <Meter
          size="sm"
          percent={account.creditLimit ? (owed / account.creditLimit) * 100 : 0}
          tone={availableCredit < 0 ? 'bg-destructive' : 'bg-foreground/50'}
          label={`${account.name} credit used`}
          valueHidden={hideSensitive}
        />
        <dl className="grid grid-cols-2 gap-3 text-label">
          <div className="min-w-0 space-y-1">
            <dt className="text-muted-foreground">{availableCredit < 0 ? 'Over limit by' : 'Available credit'}</dt>
            <dd className="break-words font-semibold tabular-nums text-foreground">
              <SensitiveAmount value={Math.abs(availableCredit)} isMasked={hideSensitive} formatFn={formatMoney} />
            </dd>
          </div>
          <div className="min-w-0 space-y-1 text-right">
            <dt className="text-muted-foreground">Credit limit</dt>
            <dd className="break-words font-semibold tabular-nums text-foreground">
              <SensitiveAmount value={account.creditLimit!} isMasked={hideSensitive} formatFn={formatMoney} />
            </dd>
          </div>
        </dl>
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
