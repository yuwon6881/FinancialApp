import { useEffect, useRef, useState } from 'react'
import type { LedgerAccount, RecurringPayment, Transaction, TransactionCategory } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import type { LedgerAccountReconcileInput } from '../../../lib/api/accounts'
import { formatCurrencyVal } from '../../../lib/utils'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import { roundMoney } from '../../../lib/money'
import { CustomConfirmModal } from '../../ui/CustomConfirmModal'
import { Input } from '../../ui/Input'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { buildSingleAccountCorrection } from '../../../lib/accountBalanceCorrection'
import { isCreditCardKind } from '../../../lib/creditCards'
import { AccountFormSheet, type AccountFormSaveInput } from './AccountFormSheet'
import { BucketAccountGroup } from './BucketAccountGroup'
import { BucketAccountSetupSheet } from './BucketAccountSetupSheet'
import { ClearCardBalanceSheet } from './ClearCardBalanceSheet'
import { useHighlightedElement } from '../../ui/useHighlightedElement'
import {
  hasBucketAccountSetupChanged,
  type BucketSetupPrefill,
  type BucketSetupSessionSnapshot,
} from './view/useBucketAccountSetupView'
import { useAccountsView } from './view/useAccountsView'
import { AlertBanner } from '../../ui/AlertBanner'
import { SegmentedMeter } from '../../ui/SegmentedMeter'

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
  /** The user's categories; a card rebate is filed under one of them. */
  categories?: TransactionCategory[]
  /** Queues a card payment and, when the bank took some off, its rebate. */
  onSettleCard?: (transactions: Array<Omit<Transaction, 'id'>>) => void
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
    <span className={value > 0 ? 'text-accent-ink font-semibold' : 'text-destructive font-semibold'}>
      {value > 0 ? '+' : '−'}
      <SensitiveAmount
        value={Math.abs(value)}
        isMasked={hideSensitive}
        formatFn={amount => formatCurrencyVal(amount, currency)}
        className="font-semibold"
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
  categories = [],
  onSettleCard,
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
  const [clearingCardId, setClearingCardId] = useState<string | null>(null)
  useEffect(() => {
    if (hideSensitive || disabled) setClearingCardId(null)
    if (hideSensitive) {
      setIsFormOpen(false)
      setEditingAccount(null)
      setSetupBucket(null)
      setPendingBalanceCorrection(null)
    }
  }, [hideSensitive, disabled])
  // Read from the live list so the sheet shows the balance as it is now, not when it was opened.
  const clearingCard = clearingCardId ? accounts.find(account => account.id === clearingCardId) ?? null : null

  const editSessionSnapshotRef = useRef<BucketSetupSessionSnapshot | null>(null)

  const openAdd = (bucket: LedgerAccount['bucket'] = 'Essentials') => {
    if (disabled || hideSensitive) return
    setEditingAccount(null)
    setFormDefaultBucket(bucket)
    setIsFormOpen(true)
  }

  const openEdit = (account: LedgerAccount) => {
    if (disabled || hideSensitive) return
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

  const openClearCard = (card: LedgerAccount) => {
    if (disabled || hideSensitive) return
    setClearingCardId(card.id)
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
          nextCreditLimit: input.creditLimit,
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
        ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
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

  const bucketTotals = bucketGroups.map(group => ({
    bucket: group.bucket,
    total: group.allBucketAccounts.filter(account => !account.isArchived).reduce((sum, account) => sum + account.remaining, 0),
  }))
  const netTotal = bucketTotals.reduce((sum, item) => sum + item.total, 0)

  const activeGroup = editingAccount
    ? bucketGroups.find(g => g.bucket === editingAccount.bucket)
    : bucketGroups.find(g => g.bucket === formDefaultBucket)

  return (
    <>
      {/* Wealth › Accounts has no tab row, so this is a named region rather than a tab panel. */}
      <section
        id="settings-panel-accounts"
        aria-labelledby="accounts-region-title"
        className="space-y-6 animate-in fade-in duration-200"
      >
        <h3 id="accounts-region-title" className="sr-only">Accounts</h3>
        {/* What all the accounts add up to, card balances already netted off, then how that total
            divides across the four buckets -- the one figure the bucket cards below never state. */}
        {openAccountCount > 0 && (
          <div className="rounded-panel bg-surface-2/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="text-label text-muted-foreground">Total across accounts</p>
                <SensitiveAmount
                  value={netTotal}
                  isMasked={hideSensitive}
                  formatFn={value => formatCurrencyVal(value, currency)}
                  className="mt-1 block text-display text-foreground tabular-nums sm:text-hero"
                />
              </div>
              <p className="text-label text-muted-foreground">
                {openAccountCount} open {openAccountCount === 1 ? 'account' : 'accounts'}
                {archivedAccountCount > 0 && <> · {archivedAccountCount} closed</>}
              </p>
            </div>
            <SegmentedMeter
              className="mt-5"
              label={bucketTotals.map(item => `${item.bucket} ${hideSensitive ? '' : formatCurrencyVal(item.total, currency)}`.trim()).join(', ')}
              segments={bucketTotals.map(item => ({ label: item.bucket, value: Math.max(0, item.total), color: getCategoryChartColor(item.bucket) }))}
            />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-label">
              {bucketTotals.map(item => (
                <li key={item.bucket} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: getCategoryChartColor(item.bucket) }} />
                  <span className="text-muted-foreground">{item.bucket}</span>
                  <SensitiveAmount value={item.total} isMasked={hideSensitive} formatFn={value => formatCurrencyVal(value, currency)} className="font-medium text-foreground tabular-nums" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isCurrentCycle && (
          <AlertBanner variant="info" title="Balances shown here are today's">
            Account corrections always use today's balance and post to today's cycle. A past cycle's closing balance is historical and cannot be changed here.
          </AlertBanner>
        )}

        {/* Search filter input */}
        {rows.length > 0 && (
          <div className="max-w-sm">
            <Input
              className="rounded-full px-4"
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
              disabled={disabled || hideSensitive}
              isDeleting={isDeleting}
              isSyncing={isSyncing}
              billRosters={billRosters}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={onRequestDeleteAccount}
              onMoveMoney={openSetup}
              onNavigateToRecurring={onNavigateToRecurring}
              onClearCard={onSettleCard ? openClearCard : undefined}
              searchQuery={searchQuery}
            />
          ))}
        </div>

      </section>

      {/* Account form sheet */}
      <AccountFormSheet
        isOpen={isFormOpen && !pendingBalanceCorrection && !hideSensitive}
        account={editingAccount}
        existingAccounts={accounts}
        bucketAccounts={activeGroup?.allBucketAccounts}
        bucketTotal={activeGroup?.balance}
        defaultBucket={formDefaultBucket}
        currency={currency}
        onClose={closeForm}
        onSave={handleFormSave}
      />

      {/* Setup / Update balances sheet */}
      <BucketAccountSetupSheet
        isOpen={setupBucket !== null && !hideSensitive}
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

      {/* Clear credit card balance sheet */}
      {onSettleCard && (
        <ClearCardBalanceSheet
          card={hideSensitive || disabled || clearingCard?.isArchived ? null : clearingCard}
          accounts={accounts}
          categories={categories}
          currency={currency}
          onClose={() => setClearingCardId(null)}
          onConfirm={onSettleCard}
        />
      )}

      {/* Single-account balance correction confirmation modal */}
      <CustomConfirmModal
        isOpen={Boolean(pendingBalanceCorrection) && !hideSensitive}
        title="Confirm balance correction"
        confirmText="Apply balance correction"
        cancelText="Go back"
        variant="primary"
        message={pendingBalanceCorrection && (
          <div className="space-y-3">
            <p>
              {isCreditCardKind(pendingBalanceCorrection.correction.targets.find(target => target.id === pendingBalanceCorrection.account.id)?.kind)
                ? <>The amount owed on <span className="font-semibold text-foreground">{pendingBalanceCorrection.account.name}</span> will be corrected from <span className="font-semibold text-foreground">{formatCurrencyVal(Math.max(0, -pendingBalanceCorrection.account.remaining), currency)}</span> to <span className="font-semibold text-foreground">{formatCurrencyVal(Math.max(0, -pendingBalanceCorrection.targetBalance), currency)}</span>.</>
                : <>The balance for <span className="font-semibold text-foreground">{pendingBalanceCorrection.account.name}</span> will be corrected from <span className="font-semibold text-foreground">{formatCurrencyVal(pendingBalanceCorrection.account.remaining, currency)}</span> to <span className="font-semibold text-foreground">{formatCurrencyVal(pendingBalanceCorrection.targetBalance, currency)}</span>.</>}
            </p>
            <div className="space-y-1.5 rounded-control bg-surface-2/70 p-3 text-label">
              <div className="flex items-center justify-between gap-3">
                <span>Current {pendingBalanceCorrection.account.bucket} total</span>
                <span className="font-semibold text-foreground">{formatCurrencyVal(pendingBalanceCorrection.bucketTotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>New {pendingBalanceCorrection.account.bucket} total</span>
                <span className="font-semibold text-foreground">
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
