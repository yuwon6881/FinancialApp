import { useState } from 'react'
import { Info, LockKeyhole } from 'lucide-react'
import type { LedgerAccount } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import { formatCurrencyVal } from '../../../lib/utils'
import { ManageableNameList } from '../ManageableNameList'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { AccountFormSheet } from './AccountFormSheet'
import { useAccountsView } from './view/useAccountsView'

interface AccountsSectionProps {
  accounts: LedgerAccount[]
  currency: string
  hideSensitive: boolean
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingId?: string | null
  disabled?: boolean
  onAddAccount: (input: LedgerAccountInput) => Promise<void> | void
  onUpdateAccount: (id: string, input: LedgerAccountInput) => Promise<void> | void
  onRequestDeleteAccount: (id: string) => void
}

const KIND_LABELS: Record<LedgerAccount['kind'], string> = {
  Bank: 'Bank account',
  EWallet: 'E-wallet',
  Cash: 'Cash',
  Card: 'Card',
}

export function AccountsSection({
  accounts,
  currency,
  hideSensitive,
  activeSyncId,
  activeSyncIds,
  deletingId,
  disabled = false,
  onAddAccount,
  onUpdateAccount,
  onRequestDeleteAccount,
}: AccountsSectionProps) {
  const { rows, isSyncing, isDeleting } = useAccountsView({ accounts, activeSyncId, activeSyncIds, deletingId })
  const [editingAccount, setEditingAccount] = useState<LedgerAccount | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const openAdd = () => {
    if (disabled) return
    setEditingAccount(null)
    setIsFormOpen(true)
  }

  const openEdit = (account: LedgerAccount) => {
    if (disabled) return
    setEditingAccount(account)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingAccount(null)
  }

  return (
    <>
      <section id="settings-panel-accounts" role="tabpanel" aria-labelledby="settings-tab-accounts" className="app-panel space-y-5 animate-in fade-in duration-200">
        <div className="flex items-start gap-3 border-b border-border/40 pb-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-accent-ink">
            <LockKeyhole className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground">Accounts attached to buckets</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Keep the same four bucket totals, while showing which real-world accounts make up each one.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/15 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p>
            Accounts are optional. With no accounts in a bucket, the app keeps using the bucket total exactly as before. If one physical account holds money in two buckets, add one row for each bucket so the amounts stay clear.
          </p>
        </div>

        <ManageableNameList
          items={rows}
          itemLabel="Account"
          addPlaceholder="Account name"
          onAddClick={openAdd}
          onAdd={() => undefined}
          onEdit={openEdit}
          onDelete={item => onRequestDeleteAccount(item.id)}
          disabled={disabled || hideSensitive}
          renderName={item => (
            <div className="min-w-0">
              <p className={`truncate font-semibold ${item.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground'}`}>
                {item.name}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {item.bucket} · {KIND_LABELS[item.kind]}{item.isDefault ? ' · Default' : ''}{item.isArchived ? ' · Closed' : ''}
              </p>
            </div>
          )}
          renderMeta={item => (
            <SensitiveAmount
              value={item.remaining}
              isMasked={hideSensitive}
              formatFn={value => formatCurrencyVal(value, currency)}
              className={`shrink-0 text-xs font-bold ${item.isArchived ? 'text-muted-foreground' : 'text-foreground'}`}
            />
          )}
          renderStatus={item => (
            <RowSyncStatus
              isDeleting={isDeleting(item.id)}
              isSyncing={isSyncing(item.id)}
              isPending={item.isPendingSync}
              entityLabel="account"
            />
          )}
        />

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Account balances are derived from the bucket ledger. Starting amounts are ordinary adjustments, and positive starting money in Stability naturally pays down an emergency-fund reload before it becomes free balance.
        </p>
      </section>

      <AccountFormSheet
        isOpen={isFormOpen}
        account={editingAccount}
        existingAccounts={rows}
        currency={currency}
        defaultIsDefault={editingAccount?.isDefault ?? false}
        onClose={closeForm}
        onSave={input => editingAccount ? onUpdateAccount(editingAccount.id, input) : onAddAccount(input)}
      />
    </>
  )
}
