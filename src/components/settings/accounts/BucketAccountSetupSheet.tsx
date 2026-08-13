import { useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Plus, Trash2 } from 'lucide-react'
import type { LedgerAccount, LedgerAccountKind, Transaction } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import { formatCurrencyVal } from '../../../lib/utils'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { CustomConfirmModal } from '../../ui/CustomConfirmModal'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { ModalActions } from '../../ui/ModalActions'
import { SensitiveAmount } from '../../ui/SensitiveAmount'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import { ACCOUNT_KIND_OPTIONS } from './accountOptions'
import {
  useBucketAccountSetupView,
  type BucketSetupDraftAccount,
  type BucketSetupPrefill,
} from './view/useBucketAccountSetupView'

interface BucketAccountSetupSheetProps {
  isOpen: boolean
  bucket: LedgerAccount['bucket'] | null
  accounts: LedgerAccount[]
  bucketTotal: number
  currency: string
  hideSensitive: boolean
  disabled?: boolean
  initialDraft?: BucketSetupPrefill | null
  onClose: () => void
  onAddAccount: (input: LedgerAccountInput) => Promise<void> | void
  onAddBalanceAdjustment: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
}

const localDateString = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function SignedAmount({ value, currency, hideSensitive }: { value: number; currency: string; hideSensitive: boolean }) {
  if (Math.abs(value) < 0.005) return <span className="text-muted-foreground">No change</span>
  return (
    <span className={value > 0 ? 'text-accent-ink' : 'text-destructive'}>
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

function NewAccountRow({
  draft,
  currency,
  error,
  targetError,
  canChooseDefault,
  onChange,
  onTargetChange,
  onDefaultChange,
  onRemove,
}: {
  draft: BucketSetupDraftAccount
  currency: string
  error?: string
  targetError?: string
  canChooseDefault: boolean
  onChange: (change: Partial<Omit<BucketSetupDraftAccount, 'id'>>) => void
  onTargetChange: (rawValue: string) => void
  onDefaultChange: (checked: boolean) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-accent-ink/20 bg-accent/10 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-foreground">New account row</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Add another place where this bucket’s money lives.</p>
        </div>
        <Button variant="ghost" size="icon" type="button" onClick={onRemove} aria-label={`Remove ${draft.name || 'new account row'}`}>
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
        </Button>
      </div>
      <FormField label="Account name" required error={error}>
        <Input
          value={draft.name}
          onChange={event => onChange({ name: event.target.value })}
          maxLength={200}
          autoComplete="off"
          placeholder="e.g. Main bank account"
        />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Account type" required>
          <CustomSelect
            value={draft.kind}
            onChange={(value: LedgerAccountKind) => onChange({ kind: value })}
            options={ACCOUNT_KIND_OPTIONS}
            ariaLabel={`${draft.name || 'New'} account type`}
            className="w-full"
          />
        </FormField>
        <FormField label={`Current balance (${currency})`} required error={targetError}>
          <SmartAmountInput
            value={draft.target}
            onChange={event => onTargetChange(event.target.value)}
            placeholder="0.00"
          />
        </FormField>
      </div>
      {canChooseDefault && (
        <label className="flex cursor-pointer items-start gap-2 text-[11px] font-semibold text-foreground">
          <Checkbox checked={draft.isDefault} onChange={event => onDefaultChange(event.target.checked)} className="mt-0.5 size-5" />
          <span>
            Use as the default for this bucket
            <span className="mt-0.5 block font-normal leading-relaxed text-muted-foreground">Unassigned bucket history will appear here after setup.</span>
          </span>
        </label>
      )}
    </div>
  )
}

export function BucketAccountSetupSheet({
  isOpen,
  bucket,
  accounts,
  bucketTotal,
  currency,
  hideSensitive,
  disabled = false,
  initialDraft = null,
  onClose,
  onAddAccount,
  onAddBalanceAdjustment,
}: BucketAccountSetupSheetProps) {
  const view = useBucketAccountSetupView({ isOpen, bucket, accounts, bucketTotal, initialDraft })
  const isBusy = disabled || hideSensitive
  const [isApplying, setIsApplying] = useState(false)

  const handleConfirm = async () => {
    if (!view.pending || !bucket) return
    const pending = view.pending
    const date = localDateString()
    setIsApplying(true)
    try {
      for (const draft of pending.drafts) {
        await onAddAccount({
          id: draft.id,
          name: draft.name,
          bucket,
          kind: draft.kind,
          openingAmount: 0,
          isDefault: draft.isDefault,
          isArchived: false,
        })
      }
      for (const account of pending.preview.accountAdjustments) {
        await onAddBalanceAdjustment({
          description: `Account balance alignment - ${account.name}`,
          amount: account.diff,
          category: 'Adjustment',
          ledgerCategory: bucket,
          accountId: account.id,
          date,
        })
      }
      view.clearPending()
      onClose()
    } finally {
      setIsApplying(false)
    }
  }

  const formatAmount = (value: number) => (
    <SensitiveAmount
      value={value}
      isMasked={hideSensitive}
      formatFn={amount => formatCurrencyVal(amount, currency)}
      className="font-bold text-foreground"
    />
  )

  return (
    <>
      <BottomSheet
        isOpen={isOpen && !view.pending}
        title={bucket ? `Set up ${bucket} accounts` : 'Set up accounts'}
        description="Choose the accounts in this bucket and set the amount each one holds today. The bucket total will only change after you confirm it."
        onClose={onClose}
        maxWidthClassName="max-w-2xl"
        footer={(
          <ModalActions>
            <Button variant="outline" type="button" onClick={onClose} disabled={isBusy}>Cancel</Button>
            <Button type="button" onClick={view.prepareReview} disabled={isBusy || !view.canReview}>
              Review setup
            </Button>
          </ModalActions>
        )}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
              <span className="block text-[10px] font-semibold text-muted-foreground">Current bucket total</span>
              <span className="mt-1 block text-sm">{formatAmount(bucketTotal)}</span>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
              <span className="block text-[10px] font-semibold text-muted-foreground">Current account total</span>
              <span className="mt-1 block text-sm">{view.preview ? formatAmount(view.preview.currentAccountTotal) : 'Enter balances'}</span>
            </div>
            <div className={`rounded-xl border p-3 ${view.preview?.bucketDifference && Math.abs(view.preview.bucketDifference) >= view.epsilon ? 'border-accent-ink/30 bg-accent/15' : 'border-border/60 bg-muted/15'}`}>
              <span className="block text-[10px] font-semibold text-muted-foreground">Change to bucket total</span>
              <span className="mt-1 block text-sm">
                {view.preview ? <SignedAmount value={view.preview.bucketDifference} currency={currency} hideSensitive={hideSensitive} /> : 'Enter balances'}
              </span>
            </div>
          </div>

          {view.errors.form && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-[11px] leading-relaxed text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p>{view.errors.form}</p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-accent-ink/20 bg-accent/15 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
            <p>Enter the amount each open account holds today. If those amounts do not add up to the bucket total, the next screen will show the exact bucket adjustment and ask you to confirm it.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-foreground">Accounts in {bucket}</h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Closed accounts remain in the total and cannot be changed here.</p>
              </div>
              <Button variant="outline" size="sm" type="button" onClick={view.addDraft} disabled={isBusy}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add account
              </Button>
            </div>

            {view.bucketAccounts.map(account => (
              <div key={account.id} className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)] items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3">
                <div className="min-w-0">
                  <p className={`truncate text-xs font-semibold ${account.isArchived ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {account.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {account.isArchived ? 'Closed account · kept for history' : account.isDefault ? 'Default account' : 'Open account'}
                  </p>
                </div>
                {account.isArchived ? (
                  <div className="text-right text-xs">{formatAmount(account.remaining)}</div>
                ) : (
                  <FormField label={`Current balance for ${account.name}`} error={view.errors[account.id]}>
                    <SmartAmountInput
                      value={view.targetInputs[account.id] ?? ''}
                      onChange={event => view.updateTarget(account.id, event.target.value)}
                      placeholder="0.00"
                    />
                  </FormField>
                )}
              </div>
            ))}

            {view.drafts.map(draft => (
              <NewAccountRow
                key={draft.id}
                draft={draft}
                currency={currency}
                error={view.errors[draft.id]}
                targetError={view.errors[`${draft.id}-target`]}
                canChooseDefault={!view.hasLiveDefault}
                onChange={change => view.updateDraft(draft.id, change)}
                onTargetChange={value => view.updateDraftTarget(draft.id, value)}
                onDefaultChange={checked => view.updateDraftDefault(draft.id, checked)}
                onRemove={() => view.removeDraft(draft.id)}
              />
            ))}

            {view.bucketAccounts.length === 0 && view.drafts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
                Add at least one account row to start this bucket split.
              </div>
            )}
          </div>

          {view.preview && view.preview.accountAdjustments.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/15 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <CheckCircle2 className="size-4 text-accent-ink" aria-hidden="true" />
                Planned balance changes
              </div>
              {view.preview.accountAdjustments.map(account => (
                <div key={account.id} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="min-w-0 truncate">{account.name}</span>
                  <SignedAmount value={account.diff} currency={currency} hideSensitive={hideSensitive} />
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheet>

      <CustomConfirmModal
        isOpen={Boolean(view.pending)}
        title={view.pending?.preview.bucketDifference && Math.abs(view.pending.preview.bucketDifference) >= view.epsilon ? 'Confirm bucket adjustment' : 'Confirm account setup'}
        confirmText="Apply account setup"
        cancelText="Go back"
        variant="primary"
        message={view.pending && (
          <div className="space-y-3">
            <p>
              {view.pending.preview.bucketDifference && Math.abs(view.pending.preview.bucketDifference) >= view.epsilon
                ? 'The requested account amounts do not match the current bucket total.'
                : 'The bucket total will stay the same while its amount is assigned across these account rows.'}
            </p>
            <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3"><span>Current bucket total</span><span>{formatAmount(view.pending.preview.bucketTotal)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Target account total</span><span>{formatAmount(view.pending.preview.targetAccountTotal)}</span></div>
              <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5"><span>Bucket adjustment</span><SignedAmount value={view.pending.preview.bucketDifference} currency={currency} hideSensitive={hideSensitive} /></div>
            </div>
            {view.pending.preview.accountAdjustments.length > 0 && (
              <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                {view.pending.preview.accountAdjustments.map(account => (
                  <div key={account.id} className="flex items-center justify-between gap-3 text-[11px]"><span className="truncate">{account.name}</span><SignedAmount value={account.diff} currency={currency} hideSensitive={hideSensitive} /></div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">This records ordinary ledger adjustments for the account rows. You can review them later in the Ledger.</p>
          </div>
        )}
        onCancel={view.clearPending}
        onConfirm={() => { void handleConfirm() }}
        isConfirming={isApplying}
        confirmingText="Applying..."
      />
    </>
  )
}
