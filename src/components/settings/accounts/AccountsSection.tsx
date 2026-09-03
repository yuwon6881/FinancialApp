import { useEffect, useRef, useState } from 'react'
import { Building2, CircleHelp } from 'lucide-react'
import type { LedgerAccount, RecurringPayment } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import type { LedgerAccountReconcileInput } from '../../../lib/api/accounts'
import { cn, formatCurrencyVal } from '../../../lib/utils'
import { roundMoney } from '../../../lib/money'
import { CustomConfirmModal } from '../../ui/CustomConfirmModal'
import { Input } from '../../ui/Input'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { buildSingleAccountCorrection } from '../../../lib/accountBalanceCorrection'
import { AccountFormSheet, type AccountFormSaveInput } from './AccountFormSheet'
import { BucketAccountGroup } from './BucketAccountGroup'
import { BucketAccountSetupSheet } from './BucketAccountSetupSheet'
import { useHighlightedElement } from '../../ui/useHighlightedElement'
import {
  hasBucketAccountSetupChanged,
  type BucketSetupPrefill,
  type BucketSetupSessionSnapshot,
} from './view/useBucketAccountSetupView'
import { useAccountsView } from './view/useAccountsView'
import { AlertBanner } from '../../ui/AlertBanner'
import { panelClass } from '../../ui/Panel'

interface AccountsSectionProps {
  accounts: LedgerAccount[]
  recurringPayments?: readonly RecurringPayment[]
  currency: string
  hideSensitive: boolean
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  deletingId?: string | null
  disabled?: boolean
  highlightedAccountId?: string | null
  onClearHighlightedAccount?: () => void
  onAddAccount: (input: LedgerAccountInput) => Promise<void> | void
  onUpdateAccount: (id: string, input: LedgerAccountInput) => Promise<void> | void
  onRequestDeleteAccount: (id: string) => void
  onReconcileAccounts: (input: LedgerAccountReconcileInput) => Promise<void> | void
  onNavigateToRecurring?: (recurringId: string) => void
  isCurrentCycle: boolean
}

interface PendingBalanceCorrection {
  correction: LedgerAccountReconcileInput
  account: LedgerAccount
  targetBalance: number
  bucketTotal: number
}

function SignedAmount({ value, currency, hideSensitive }: { value: number; currency: string; hideSensitive: boolean }) {
  if (Math.abs(value) < 0.005) return <span className="text-muted-foreground">No change</span>
  return (
    <span className={value > 0 ? 'text-accent-ink font-bold' : 'text-destructive font-bold'}>
      {value > 0 ? '+' : '−'}
      <SensitiveAmount
        value={Math.abs(value)}
        isMasked={hideSensitive}
        formatFn={amount => formatCurrencyVal(amount, currency)}
        className="font-bold"
      />
    </span>
  )
}

export function AccountsSection({
  accounts,
  recurringPayments,
  currency,
  hideSensitive,
  activeSyncId,
  activeSyncIds,
  deletingId,
  disabled = false,
  highlightedAccountId,
  onClearHighlightedAccount,
  onAddAccount,
  onUpdateAccount,
  onRequestDeleteAccount,
  onReconcileAccounts,
  onNavigateToRecurring,
  isCurrentCycle,
}: AccountsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const {
    rows,
    billRosters,
    bucketGroups,
    openAccountCount,
    archivedAccountCount,
    isSyncing,
    isDeleting,
  } = useAccountsView({
    accounts,
    recurringPayments,
    activeSyncId,
    activeSyncIds,
    deletingId,
    searchQuery,
  })

  const matchingBucket = highlightedAccountId
    ? bucketGroups.find(g => g.bucket.toLowerCase() === highlightedAccountId.toLowerCase())
    : null
  const highlightTargetId = highlightedAccountId
    ? (matchingBucket
        ? `bucket-account-group-${matchingBucket.bucket}`
        : accounts.some(a => a.id === highlightedAccountId)
          ? `account-row-${highlightedAccountId}`
          : 'settings-panel-accounts')
    : null
  useEffect(() => {
    if (highlightedAccountId) setSearchQuery('')
  }, [highlightedAccountId])
  useHighlightedElement(highlightTargetId, onClearHighlightedAccount)

  const [editingAccount, setEditingAccount] = useState<LedgerAccount | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formDefaultBucket, setFormDefaultBucket] = useState<LedgerAccount['bucket']>('Essentials')
  const [setupBucket, setSetupBucket] = useState<LedgerAccount['bucket'] | null>(null)
  const [setupPrefill, setSetupPrefill] = useState<BucketSetupPrefill | null>(null)
  const [pendingBalanceCorrection, setPendingBalanceCorrection] = useState<PendingBalanceCorrection | null>(null)
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false)

  const editSessionSnapshotRef = useRef<BucketSetupSessionSnapshot | null>(null)

  const openAdd = (bucket: LedgerAccount['bucket'] = 'Essentials') => {
    if (disabled) return
    setEditingAccount(null)
    setFormDefaultBucket(bucket)
    setIsFormOpen(true)
  }

  const openEdit = (account: LedgerAccount) => {
    if (disabled) return
    const group = bucketGroups.find(g => g.bucket === account.bucket)
    editSessionSnapshotRef.current = {
      bucketTotal: roundMoney(group?.balance ?? 0),
      accounts: (group?.allBucketAccounts ?? []).map(item => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        isArchived: item.isArchived,
        remaining: roundMoney(item.remaining),
      })),
    }
    setEditingAccount(account)
    setFormDefaultBucket(account.bucket)
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
    editSessionSnapshotRef.current = null
  }

  const handleFormSave = async (input: AccountFormSaveInput) => {
    if (editingAccount) {
      if (input.targetBalance !== undefined && Math.abs(input.targetBalance - editingAccount.remaining) >= 0.005) {
        const group = bucketGroups.find(g => g.bucket === editingAccount.bucket)
        const currentBucketTotal = group?.balance ?? 0
        const currentBucketAccounts = group?.allBucketAccounts ?? []

        const hasExternalChanges = hasBucketAccountSetupChanged(
          editSessionSnapshotRef.current,
          currentBucketTotal,
          currentBucketAccounts,
        )
        if (hasExternalChanges) {
          alert('The bucket or account balances changed while this form was open. Close and reopen the form before saving.')
          return
        }

        const correction = buildSingleAccountCorrection({
          account: editingAccount,
          bucketAccounts: currentBucketAccounts,
          nextBalance: input.targetBalance,
          nextName: input.name,
          nextKind: input.kind,
          isArchived: input.isArchived,
        })

        if (correction) {
          setPendingBalanceCorrection({
            correction,
            account: editingAccount,
            targetBalance: input.targetBalance,
            bucketTotal: currentBucketTotal,
          })
          return
        }
      }

      await onUpdateAccount(editingAccount.id, input)
      return
    }

    const openingAmount = Number(input.openingAmount ?? 0)
    if (Number.isFinite(openingAmount) && Math.abs(openingAmount) >= 0.005) {
      openSetup(input.bucket, {
        name: input.name,
        kind: input.kind,
        target: openingAmount,
      })
      closeForm()
      return
    }
    await onAddAccount({ ...input, openingAmount: 0 })
  }

  const handleConfirmBalanceCorrection = async () => {
    if (!pendingBalanceCorrection) return
    setIsApplyingCorrection(true)
    try {
      await onReconcileAccounts(pendingBalanceCorrection.correction)
      setPendingBalanceCorrection(null)
      closeForm()
    } finally {
      setIsApplyingCorrection(false)
    }
  }

  const activeGroup = editingAccount
    ? bucketGroups.find(g => g.bucket === editingAccount.bucket)
    : bucketGroups.find(g => g.bucket === formDefaultBucket)

  return (
    <>
      <section
        id="settings-panel-accounts"
        role="tabpanel"
        aria-labelledby="settings-tab-accounts"
        className={cn(panelClass, 'space-y-6 p-4 animate-in fade-in duration-200 sm:p-5')}
      >
        {/* Panel Header */}
        <div className="flex flex-col gap-3 border-b border-border/40 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-accent-ink/20 bg-accent/50 text-accent-ink">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground">Accounts</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Connect where your money lives to the four budget buckets.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-1">
              {openAccountCount} open {openAccountCount === 1 ? 'account' : 'accounts'}
            </span>
            {archivedAccountCount > 0 && (
              <span className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-1">
                {archivedAccountCount} closed
              </span>
            )}
          </div>
        </div>

        {!isCurrentCycle && (
          <AlertBanner variant="info" title="Balances shown here are today's">
            Account corrections always use today's balance and post to today's cycle. A past cycle's closing balance is historical and cannot be changed here.
          </AlertBanner>
        )}

        {/* Search filter input */}
        {rows.length > 0 && (
          <div className="max-w-sm">
            <Input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Filter accounts by name or type…"
              aria-label="Filter accounts"
              autoComplete="off"
            />
          </div>
        )}

        {/* 4 BucketAccountGroup cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bucketGroups.map(group => (
            <BucketAccountGroup
              key={group.bucket}
              bucket={group.bucket}
              description={group.description}
              accounts={group.accounts}
              allBucketAccounts={group.allBucketAccounts}
              currency={currency}
              hideSensitive={hideSensitive}
              disabled={disabled}
              isDeleting={isDeleting}
              isSyncing={isSyncing}
              billRosters={billRosters}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={onRequestDeleteAccount}
              onMoveMoney={openSetup}
              onNavigateToRecurring={onNavigateToRecurring}
              searchQuery={searchQuery}
            />
          ))}
        </div>

        {/* Footer info callout */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/10 p-3 text-xs leading-relaxed text-muted-foreground">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p>
            <span className="font-semibold text-foreground">Balances are ledger-tracked.</span> Starting amounts are reviewed against bucket totals, and Stability credits automatically satisfy emergency reloads.
          </p>
        </div>
      </section>

      {/* Account form sheet */}
      <AccountFormSheet
        isOpen={isFormOpen && !pendingBalanceCorrection}
        account={editingAccount}
        bucketAccounts={activeGroup?.allBucketAccounts}
        bucketTotal={activeGroup?.balance}
        defaultBucket={formDefaultBucket}
        currency={currency}
        onClose={closeForm}
        onSave={handleFormSave}
      />

      {/* Setup / Update balances sheet */}
      <BucketAccountSetupSheet
        isOpen={setupBucket !== null}
        bucket={setupBucket}
        // Reconciliation must include every account in the bucket; the search result is only for
        // display and must never turn a filtered edit into a partial bucket snapshot.
        accounts={bucketGroups.find(group => group.bucket === setupBucket)?.allBucketAccounts ?? []}
        bucketTotal={bucketGroups.find(group => group.bucket === setupBucket)?.balance ?? 0}
        currency={currency}
        hideSensitive={hideSensitive}
        disabled={disabled}
        initialDraft={setupPrefill}
        onClose={() => {
          setSetupBucket(null)
          setSetupPrefill(null)
        }}
        onReconcileAccounts={onReconcileAccounts}
      />

      {/* Single-account balance correction confirmation modal */}
      <CustomConfirmModal
        isOpen={Boolean(pendingBalanceCorrection)}
        title="Confirm balance correction"
        confirmText="Apply balance correction"
        cancelText="Go back"
        variant="primary"
        message={pendingBalanceCorrection && (
          <div className="space-y-3">
            <p>
              The balance for <span className="font-semibold text-foreground">{pendingBalanceCorrection.account.name}</span> will be corrected from <span className="font-semibold text-foreground">{formatCurrencyVal(pendingBalanceCorrection.account.remaining, currency)}</span> to <span className="font-semibold text-foreground">{formatCurrencyVal(pendingBalanceCorrection.targetBalance, currency)}</span>.
            </p>
            <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span>Current {pendingBalanceCorrection.account.bucket} total</span>
                <span className="font-bold text-foreground">{formatCurrencyVal(pendingBalanceCorrection.bucketTotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>New {pendingBalanceCorrection.account.bucket} total</span>
                <span className="font-bold text-foreground">
                  {formatCurrencyVal(pendingBalanceCorrection.bucketTotal + (pendingBalanceCorrection.targetBalance - pendingBalanceCorrection.account.remaining), currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5">
                <span>Adjustment</span>
                <SignedAmount
                  value={pendingBalanceCorrection.targetBalance - pendingBalanceCorrection.account.remaining}
                  currency={currency}
                  hideSensitive={hideSensitive}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This records the correction on this account; a real transfer remains a separate Ledger transfer.
            </p>
          </div>
        )}
        onCancel={() => setPendingBalanceCorrection(null)}
        onConfirm={() => { void handleConfirmBalanceCorrection() }}
        isConfirming={isApplyingCorrection}
        confirmingText="Applying..."
      />
    </>
  )
}
