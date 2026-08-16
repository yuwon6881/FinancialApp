import { Banknote, CircleHelp, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react'
import type { LedgerAccount, LedgerAccountKind } from '../../../types'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { Button } from '../../ui/Button'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { ACCOUNT_INTEREST_FREQUENCY_LABELS, ACCOUNT_KIND_LABELS } from './accountOptions'

export interface AccountRowProps {
  account: LedgerAccount
  currency: string
  hideSensitive: boolean
  disabled?: boolean
  isDeleting: boolean
  isSyncing: boolean
  onEdit: (account: LedgerAccount) => void
  onDelete: (id: string) => void
}

const KIND_ICONS: Record<LedgerAccountKind, LucideIcon> = {
  Bank: Landmark,
  EWallet: Wallet,
  Cash: Banknote,
  Card: CreditCard,
  Other: CircleHelp,
}

const formatInterestRate = (value: number) => new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
}).format(value)

export function AccountRow({
  account,
  currency,
  hideSensitive,
  disabled = false,
  isDeleting,
  isSyncing,
  onEdit,
  onDelete,
}: AccountRowProps) {
  const AccountIcon = KIND_ICONS[account.kind] ?? CircleHelp
  const bucketClass = getCategoryBadgeClass(account.bucket)

  return (
    <div
      id={`account-row-${account.id}`}
      className={`flex flex-col gap-2 rounded-xl border p-3 transition duration-150 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
        account.isArchived ? 'border-dashed border-border/70 bg-card/40 opacity-75' : 'border-border/60 bg-card/70'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${bucketClass}`} aria-hidden="true">
          <AccountIcon className="size-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className={`truncate text-xs font-semibold sm:text-sm ${account.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground'}`}>
            {account.name}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{ACCOUNT_KIND_LABELS[account.kind] ?? account.kind}</span>
            {account.interestEnabled && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatInterestRate(account.interestRatePercent)}% / yr ({ACCOUNT_INTEREST_FREQUENCY_LABELS[account.interestFrequency]})</span>
              </>
            )}
            {account.isArchived && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-muted-foreground">Closed</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-2">
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

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(account)}
            disabled={disabled || isDeleting}
            aria-label={`Edit ${account.name}`}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="danger"
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
  )
}
