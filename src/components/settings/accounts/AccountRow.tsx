import { Banknote, CircleHelp, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react'
import type { LedgerAccount, LedgerAccountKind } from '../../../types'
import type { AccountBillRoster as AccountBillRosterType } from '../../../lib/accountBillRoster'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { Button } from '../../ui/Button'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { AccountBillRoster } from './AccountBillRoster'
import { ACCOUNT_KIND_LABELS } from './accountOptions'

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
}

const KIND_ICONS: Record<LedgerAccountKind, LucideIcon> = {
  Bank: Landmark,
  EWallet: Wallet,
  Cash: Banknote,
  Card: CreditCard,
  Other: CircleHelp,
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
}: AccountRowProps) {
  const AccountIcon = KIND_ICONS[account.kind] ?? CircleHelp
  const bucketClass = getCategoryBadgeClass(account.bucket)

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
        <div className="flex min-w-[9rem] flex-1 items-center gap-3">
          <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${bucketClass}`} aria-hidden="true">
            <AccountIcon className="size-4" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className={`truncate text-xs font-semibold sm:text-sm ${account.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground'}`}>
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

        <div className="flex shrink-0 items-center gap-x-3 gap-y-2 sm:ml-auto">
          <div className="flex shrink-0 items-center gap-2">
            <SensitiveAmount
              value={account.remaining}
              isMasked={hideSensitive}
              formatFn={value => formatCurrencyVal(value, currency)}
              className={`text-xs font-bold sm:text-sm ${account.isArchived ? 'text-muted-foreground' : 'text-foreground'}`}
            />
            <RowSyncStatus
              isDeleting={isDeleting}
              isSyncing={isSyncing}
              isPending={account.isPendingSync}
              entityLabel="account"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
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

      <AccountBillRoster
        roster={roster}
        currency={currency}
        hideSensitive={hideSensitive}
        onNavigateToRecurring={onNavigateToRecurring}
      />
    </div>
  )
}
