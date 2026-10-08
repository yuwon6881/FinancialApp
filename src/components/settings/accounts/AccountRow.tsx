import { CircleHelp } from 'lucide-react'
import type { LedgerAccount } from '../../../types'
import type { AccountBillRoster as AccountBillRosterType } from '../../../lib/accountBillRoster'
import { cardAvailableCredit, cardOwed, isCreditCard } from '../../../lib/creditCards'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { Button } from '../../ui/Button'
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
  const bucketClass = getCategoryBadgeClass(account.bucket)
  const isCard = isCreditCard(account)
  const owed = cardOwed(account)
  const availableCredit = cardAvailableCredit(account)
  const formatMoney = (value: number) => formatCurrencyVal(value, currency)

  return (
    <div
      id={`account-row-${account.id}`}
      className={`flex flex-col gap-2 rounded-xl border p-3 transition duration-150 ${
        account.isArchived ? 'border-dashed border-border/70 bg-card/40 opacity-75' : 'border-border/60 bg-card/70'
      }`}
    >
      {/* Wraps on the row's own width rather than the window's. Inside a bucket card the row is
          about 300px wide at the narrow end of the expanded tier, where the media-query row put the
          name, the balance and both actions on one line: the name collapsed to a single letter with
          the balance printed against it. The name keeps a floor width, so the balance and actions
          drop to their own line instead of squeezing it out. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-[9rem] flex-1 items-center gap-3 overflow-hidden">
          <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${bucketClass}`} aria-hidden="true">
            <AccountIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p title={account.name} className={`truncate text-xs font-semibold sm:text-sm ${account.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground'}`}>
              {account.name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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
              <span className={`text-xs font-bold sm:text-sm ${account.isArchived ? 'text-muted-foreground' : 'text-foreground'}`}>
                {owed > 0 ? 'Owed ' : 'In credit '}
                <SensitiveAmount value={owed > 0 ? owed : account.remaining} isMasked={hideSensitive} formatFn={formatMoney} />
              </span>
            ) : (
              <SensitiveAmount
                value={account.remaining}
                isMasked={hideSensitive}
                formatFn={formatMoney}
                className={`text-xs font-bold sm:text-sm ${account.isArchived ? 'text-muted-foreground' : 'text-foreground'}`}
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
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => onEdit(account)}
              disabled={disabled || isDeleting}
              aria-label={`Edit ${account.name}`}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(account.id)}
              disabled={disabled || isDeleting}
              aria-label={`Delete ${account.name}`}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {isCard && availableCredit !== null && !account.isArchived && (
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/20 px-3 py-2 text-xs">
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
