import { useMemo, useState } from 'react'
import { Banknote, Building2, CircleHelp, CreditCard, Info, Landmark, Plus, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CategorySummary, LedgerAccount, Transaction } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { ManageableNameList } from '../ManageableNameList'
import { Button } from '../../ui/Button'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { AccountFormSheet } from './AccountFormSheet'
import { BucketAccountSetupSheet } from './BucketAccountSetupSheet'
import type { BucketSetupPrefill } from './view/useBucketAccountSetupView'
import type { LedgerAccountReconcileInput } from '../../../lib/api/accounts'
import { useAccountsView } from './view/useAccountsView'

interface AccountsSectionProps {
  accounts: LedgerAccount[]
  categoryTotals?: CategorySummary[]
  currency: string
  hideSensitive: boolean
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingId?: string | null
  disabled?: boolean
  onAddAccount: (input: LedgerAccountInput) => Promise<void> | void
  onUpdateAccount: (id: string, input: LedgerAccountInput) => Promise<void> | void
  onRequestDeleteAccount: (id: string) => void
  onAddBalanceAdjustment: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
  onReconcileAccounts?: (input: LedgerAccountReconcileInput) => Promise<void> | void
}

const KIND_LABELS: Record<LedgerAccount['kind'], string> = {
  Bank: 'Bank account',
  EWallet: 'E-wallet',
  Cash: 'Cash',
  Card: 'Card',
  Other: 'Other',
}

const KIND_ICONS: Record<LedgerAccount['kind'], LucideIcon> = {
  Bank: Landmark,
  EWallet: Wallet,
  Cash: Banknote,
  Card: CreditCard,
  Other: CircleHelp,
}

const BUCKETS: ReadonlyArray<{ name: LedgerAccount['bucket']; description: string }> = [
  { name: 'Essentials', description: 'Everyday spending' },
  { name: 'Growth', description: 'Money sent to investments' },
  { name: 'Stability', description: 'Your emergency cushion' },
  { name: 'Rewards', description: 'Plans and treats' },
]

export function AccountsSection({
  accounts,
  categoryTotals,
  currency,
  hideSensitive,
  activeSyncId,
  activeSyncIds,
  deletingId,
  disabled = false,
  onAddAccount,
  onUpdateAccount,
  onRequestDeleteAccount,
  onAddBalanceAdjustment,
  onReconcileAccounts,
}: AccountsSectionProps) {
  const { rows, isSyncing, isDeleting } = useAccountsView({ accounts, activeSyncId, activeSyncIds, deletingId })
  const [editingAccount, setEditingAccount] = useState<LedgerAccount | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [setupBucket, setSetupBucket] = useState<LedgerAccount['bucket'] | null>(null)
  const [setupPrefill, setSetupPrefill] = useState<BucketSetupPrefill | null>(null)
  const bucketSummaries = useMemo(() => BUCKETS.map(bucket => {
    const bucketRows = rows.filter(item => item.bucket === bucket.name)
    const openRows = bucketRows.filter(item => !item.isArchived)
    const bucketTotal = categoryTotals?.find(category => category.name === bucket.name)?.remaining
    return {
      ...bucket,
      count: openRows.length,
      balance: bucketTotal ?? bucketRows.reduce((total, item) => total + item.remaining, 0),
      accountTotal: bucketRows.reduce((total, item) => total + item.remaining, 0),
      accountRows: bucketRows,
    }
  }), [categoryTotals, rows])
  const openAccountCount = rows.filter(item => !item.isArchived).length
  const archivedAccountCount = rows.length - openAccountCount

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

  const openSetup = (bucket: LedgerAccount['bucket'], prefill: BucketSetupPrefill | null = null) => {
    if (disabled || hideSensitive) return
    setSetupBucket(bucket)
    setSetupPrefill(prefill)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingAccount(null)
  }

  const handleFormSave = async (input: LedgerAccountInput) => {
    if (editingAccount) {
      await onUpdateAccount(editingAccount.id, input)
      return
    }
    const openingAmount = Number(input.openingAmount ?? 0)
    if (Number.isFinite(openingAmount) && Math.abs(openingAmount) >= 0.005) {
      openSetup(input.bucket, {
        name: input.name,
        kind: input.kind,
        target: openingAmount,
        isDefault: input.isDefault,
      })
      closeForm()
      return
    }
    await onAddAccount({ ...input, openingAmount: 0 })
  }

  return (
    <>
      <section id="settings-panel-accounts" role="tabpanel" aria-labelledby="settings-tab-accounts" className="app-panel space-y-6 rounded-2xl border border-border/60 bg-card/92 p-4 animate-in fade-in duration-200 sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-accent-ink/20 bg-accent/50 text-accent-ink">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Accounts</h3>
                <span className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Optional</span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Connect the places where your money lives to the four budget buckets, so each balance is easier to understand.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                <span className="rounded-lg border border-border/60 bg-background/50 px-2 py-1">
                  {openAccountCount} open {openAccountCount === 1 ? 'account' : 'accounts'}
                </span>
                {archivedAccountCount > 0 && (
                  <span className="rounded-lg border border-border/60 bg-background/50 px-2 py-1">
                    {archivedAccountCount} closed
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {bucketSummaries.map(bucket => (
            <div key={bucket.name} className={`min-w-0 rounded-xl border bg-background/40 p-3 ${bucket.count > 0 ? 'border-border/60' : 'border-dashed border-border/50'}`}>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className={`min-w-0 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${getCategoryBadgeClass(bucket.name)}`}>
                  {bucket.name}
                </span>
                <span className="shrink-0 text-[9px] font-semibold text-muted-foreground">
                  {bucket.count ? `${bucket.count} ${bucket.count === 1 ? 'row' : 'rows'}` : 'Empty'}
                </span>
              </div>
              <SensitiveAmount
                value={bucket.balance}
                isMasked={hideSensitive}
                formatFn={value => formatCurrencyVal(value, currency)}
                className="mt-3 block truncate text-sm font-extrabold text-foreground"
              />
              <p className="mt-1 truncate text-[10px] text-muted-foreground">Bucket total · {bucket.description}</p>
              {bucket.count > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground">Accounts total</span>
                  <SensitiveAmount
                    value={bucket.accountTotal}
                    isMasked={hideSensitive}
                    formatFn={value => formatCurrencyVal(value, currency)}
                    className="truncate font-semibold text-foreground"
                  />
                </div>
              )}
              {Math.abs(bucket.accountTotal - bucket.balance) >= 0.005 && (
                <p className="mt-2 rounded-lg border border-accent-ink/20 bg-accent/15 px-2 py-1 text-[10px] font-semibold leading-relaxed text-accent-ink">
                  Account rows need review
                </p>
              )}
              <Button
                type="button"
                variant={bucket.count > 0 ? 'outline' : 'secondary'}
                size="sm"
                className="mt-3 w-full justify-center"
                onClick={() => openSetup(bucket.name)}
                disabled={disabled || hideSensitive}
              >
                {bucket.count > 0 ? 'Review split' : 'Set up accounts'}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-accent-ink/20 bg-accent/30 p-3.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p>
            Adding an account row does not change a bucket total by itself. Use <span className="font-semibold text-foreground">Set up accounts</span> on a bucket card to assign the current amount across several accounts; any mismatch is shown for confirmation before ledger adjustments are recorded.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <div>
              <h4 className="text-sm font-bold text-foreground">Account rows</h4>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Each row is one account-to-bucket connection.</p>
            </div>
            {rows.length > 0 && <span className="text-[10px] font-semibold text-muted-foreground">{rows.length} total {rows.length === 1 ? 'row' : 'rows'}</span>}
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
            listClassName="max-h-[30rem] space-y-2"
            stackActionsOnMobile
            itemClassName={item => item.isArchived ? 'border-dashed opacity-75' : 'border-border/60 bg-card/70'}
            emptyState={(
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-5 py-8 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-2xl border border-accent-ink/20 bg-accent/40 text-accent-ink">
                  <Wallet className="size-5" aria-hidden="true" />
                </div>
                <h5 className="mt-3 text-sm font-bold text-foreground">No accounts added yet</h5>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                  Add your first bank, wallet, cash, or card account to see how a bucket balance is split between real-world places.
                </p>
                <Button type="button" className="mt-4 h-11" onClick={openAdd} disabled={disabled || hideSensitive}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add an account row
                </Button>
              </div>
            )}
            renderName={item => {
              const AccountIcon = KIND_ICONS[item.kind]
              const bucketClass = getCategoryBadgeClass(item.bucket)
              return (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${bucketClass}`} aria-hidden="true">
                    <AccountIcon className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className={`truncate font-semibold ${item.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground'}`}>
                        {item.name}
                      </p>
                      {item.isDefault && <span className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-accent-ink">Default</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${bucketClass}`}>{item.bucket}</span>
                      <span aria-hidden="true">·</span>
                      <span>{KIND_LABELS[item.kind]}</span>
                      {item.isArchived && <><span aria-hidden="true">·</span><span>Closed</span></>}
                    </div>
                  </div>
                </div>
              )
            }}
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
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p><span className="font-semibold text-foreground">Balances stay ledger-based.</span> Starting amounts are reviewed against the bucket total first, and positive money in Stability naturally pays down an emergency-fund reload before it becomes free balance.</p>
        </div>
      </section>

      <AccountFormSheet
        isOpen={isFormOpen}
        account={editingAccount}
        existingAccounts={rows}
        currency={currency}
        defaultIsDefault={editingAccount?.isDefault ?? false}
        onClose={closeForm}
        onSave={handleFormSave}
      />
      <BucketAccountSetupSheet
        isOpen={setupBucket !== null}
        bucket={setupBucket}
        accounts={rows}
        bucketTotal={bucketSummaries.find(summary => summary.name === setupBucket)?.balance ?? 0}
        currency={currency}
        hideSensitive={hideSensitive}
        disabled={disabled}
        initialDraft={setupPrefill}
        onClose={() => {
          setSetupBucket(null)
          setSetupPrefill(null)
        }}
        onAddAccount={onAddAccount}
        onAddBalanceAdjustment={onAddBalanceAdjustment}
        onReconcileAccounts={onReconcileAccounts}
      />
    </>
  )
}
