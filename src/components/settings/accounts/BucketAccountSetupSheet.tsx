import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Percent, Plus, Trash2 } from 'lucide-react'
import type { LedgerAccount, LedgerAccountKind, Transaction } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import type { LedgerAccountReconcileInput } from '../../../lib/api/accounts'
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
import { ACCOUNT_INTEREST_FREQUENCY_OPTIONS, ACCOUNT_KIND_OPTIONS } from './accountOptions'
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
  onReconcileAccounts?: (input: LedgerAccountReconcileInput) => Promise<void> | void
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
  interestError,
  onChange,
  onTargetChange,
  onInterestChange,
  onRemove,
}: {
  draft: BucketSetupDraftAccount
  currency: string
  error?: string
  targetError?: string
  interestError?: string
  onChange: (change: Partial<Omit<BucketSetupDraftAccount, 'id'>>) => void
  onTargetChange: (rawValue: string) => void
  onInterestChange: (change: { enabled?: boolean; rate?: number; frequency?: BucketSetupDraftAccount['interestFrequency'] }) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-accent-ink/20 bg-accent/10 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-foreground">New account row</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Add a real account where this bucket’s money lives.</p>
        </div>
        <Button variant="ghost" size="icon" type="button" onClick={onRemove} aria-label={`Remove ${draft.name || 'new account row'}`}>
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
        </Button>
      </div>
      <FormField label="Account name" required error={error}>
        <Input value={draft.name} onChange={event => onChange({ name: event.target.value })} maxLength={200} autoComplete="off" placeholder="e.g. Main bank account" />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Account type" required>
          <CustomSelect value={draft.kind} onChange={(value: LedgerAccountKind) => onChange({ kind: value })} options={ACCOUNT_KIND_OPTIONS} ariaLabel={`${draft.name || 'New'} account type`} className="w-full" />
        </FormField>
        <FormField label={`Current balance (${currency})`} required error={targetError}>
          <SmartAmountInput value={draft.target} onChange={event => onTargetChange(event.target.value)} placeholder="0.00" />
        </FormField>
      </div>
      <div className="space-y-3 rounded-xl border border-border/50 bg-background/30 p-3">
        <label className="flex cursor-pointer items-start gap-2 text-[11px] font-semibold text-foreground">
          <Checkbox checked={draft.interestEnabled} onChange={event => onInterestChange({ enabled: event.target.checked })} className="mt-0.5 size-5" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5"><Percent className="size-3.5 text-accent-ink" aria-hidden="true" />Earn interest on this account</span>
            <span className="mt-0.5 block font-normal leading-relaxed text-muted-foreground">Interest is posted to this account and bucket.</span>
          </span>
        </label>
        {draft.interestEnabled && (
          <div className="grid grid-cols-1 gap-3 border-t border-border/40 pt-3 sm:grid-cols-2">
            <FormField label="Annual rate (%)" required error={interestError}>
              <Input type="number" inputMode="decimal" min="0.01" max="100" step="0.0001" value={draft.interestRatePercent || ''} onChange={event => onInterestChange({ rate: event.target.value ? Number(event.target.value) : 0 })} placeholder="5" />
            </FormField>
            <FormField label="Add interest" required>
              <CustomSelect value={draft.interestFrequency} onChange={value => onInterestChange({ frequency: value as BucketSetupDraftAccount['interestFrequency'] })} options={ACCOUNT_INTEREST_FREQUENCY_OPTIONS} ariaLabel={`${draft.name || 'New'} interest posting frequency`} className="w-full" />
            </FormField>
          </div>
        )}
      </div>
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
  onReconcileAccounts,
}: BucketAccountSetupSheetProps) {
  const view = useBucketAccountSetupView({ isOpen, bucket, accounts, bucketTotal, initialDraft })
  const isBusy = disabled || hideSensitive
  const [isApplying, setIsApplying] = useState(false)
  const operationIdRef = useRef<string | null>(null)

  const handleConfirm = async () => {
    if (!view.pending || !bucket) return
    const pending = view.pending
    const date = localDateString()
    setIsApplying(true)
    try {
      if (onReconcileAccounts) {
        const draftsById = new Map(pending.drafts.map(draft => [draft.id, draft]))
        const targets = pending.preview.lines.map(line => {
          const draft = draftsById.get(line.id)
          const account = accounts.find(candidate => candidate.id === line.id)
          return {
            id: line.id,
            name: line.name,
            kind: draft?.kind ?? account?.kind ?? 'Other',
            isArchived: line.isArchived,
            expectedCurrent: line.current,
            target: line.target,
            ...(draft ? {
              interestEnabled: draft.interestEnabled,
              interestRatePercent: draft.interestRatePercent,
              interestFrequency: draft.interestFrequency,
            } : {}),
          }
        })
        const operationId = operationIdRef.current ?? `reconcile-${bucket.toLowerCase()}-${Date.now()}`
        operationIdRef.current = operationId
        await onReconcileAccounts({
          operationId,
          bucket,
          expectedBucketTotal: pending.preview.bucketTotal,
          adjustmentAccountId: pending.adjustmentAccountId,
          targets,
        })
      } else {
        for (const draft of pending.drafts) {
          await onAddAccount({
            id: draft.id,
            name: draft.name,
            bucket,
            kind: draft.kind,
            openingAmount: 0,
            isArchived: false,
            interestEnabled: draft.interestEnabled,
            interestRatePercent: draft.interestRatePercent,
            interestFrequency: draft.interestFrequency,
          })
        }
        for (const account of pending.preview.accountAdjustments) {
          await onAddBalanceAdjustment({
            description: `Account balance alignment - ${account.name}`,
            amount: account.diff,
            category: 'Adjustment',
            ledgerCategory: bucket,
            excludeFromAutocomplete: true,
            accountId: account.id,
            date,
          })
        }
      }
      view.clearPending()
      operationIdRef.current = null
      onClose()
    } finally {
      setIsApplying(false)
    }
  }

  const formatAmount = (value: number) => <SensitiveAmount value={value} isMasked={hideSensitive} formatFn={amount => formatCurrencyVal(amount, currency)} className="font-bold text-foreground" />

  return (
    <>
      <BottomSheet
        isOpen={isOpen && !view.pending}
        title={bucket ? `Set up ${bucket} accounts` : 'Set up accounts'}
        description="Assign the amount held by each account. Nothing changes until you confirm."
        onClose={onClose}
        maxWidthClassName="max-w-2xl"
        footer={<ModalActions><Button variant="outline" type="button" onClick={onClose} disabled={isBusy}>Cancel</Button><Button type="button" onClick={view.prepareReview} disabled={isBusy || !view.canReview}>Review setup</Button></ModalActions>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3"><span className="block text-[10px] font-semibold text-muted-foreground">Current bucket total</span><span className="mt-1 block text-sm">{formatAmount(bucketTotal)}</span></div>
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3"><span className="block text-[10px] font-semibold text-muted-foreground">Current account total</span><span className="mt-1 block text-sm">{view.preview ? formatAmount(view.preview.currentAccountTotal) : 'Enter balances'}</span></div>
            <div className={`rounded-xl border p-3 ${view.preview?.bucketDifference && Math.abs(view.preview.bucketDifference) >= view.epsilon ? 'border-accent-ink/30 bg-accent/15' : 'border-border/60 bg-muted/15'}`}><span className="block text-[10px] font-semibold text-muted-foreground">Change to bucket total</span><span className="mt-1 block text-sm">{view.preview ? <SignedAmount value={view.preview.bucketDifference} currency={currency} hideSensitive={hideSensitive} /> : 'Enter balances'}</span></div>
          </div>
          {view.errors.form && <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-[11px] leading-relaxed text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><p>{view.errors.form}</p></div>}
          <div className="flex items-start gap-2.5 rounded-xl border border-accent-ink/20 bg-accent/15 p-3 text-[11px] leading-relaxed text-muted-foreground"><CircleHelp className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" /><p>Enter each account’s balance. The bucket total stays unchanged unless you explicitly choose an account for a correction.</p></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-bold text-foreground">Accounts in {bucket}</h4><p className="mt-0.5 text-[11px] text-muted-foreground">Closed accounts stay visible for history.</p></div><Button variant="outline" size="sm" type="button" onClick={view.addDraft} disabled={isBusy}><Plus className="size-3.5" aria-hidden="true" />Add account</Button></div>
            {view.bucketAccounts.map(account => <div key={account.id} className="grid grid-cols-1 items-center gap-2.5 rounded-2xl border border-border/60 bg-card/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)] sm:gap-3"><div className="min-w-0"><p className={`truncate text-xs font-semibold ${account.isArchived ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{account.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{account.isArchived ? 'Closed account · kept for history' : 'Open account'}</p></div>{account.isArchived ? <div className="text-right text-xs">{formatAmount(account.remaining)}</div> : <FormField label={`Current balance for ${account.name}`} error={view.errors[account.id]}><SmartAmountInput value={view.targetInputs[account.id] ?? ''} onChange={event => view.updateTarget(account.id, event.target.value)} placeholder="0.00" /></FormField>}</div>)}
            {view.drafts.map(draft => <NewAccountRow key={draft.id} draft={draft} currency={currency} error={view.errors[draft.id]} targetError={view.errors[`${draft.id}-target`]} interestError={view.errors[`${draft.id}-interest`]} onChange={change => view.updateDraft(draft.id, change)} onTargetChange={value => view.updateDraftTarget(draft.id, value)} onInterestChange={change => view.updateDraft(draft.id, { ...(change.enabled === undefined ? {} : { interestEnabled: change.enabled, interestRatePercent: change.enabled ? draft.interestRatePercent : 0 }), ...(change.rate === undefined ? {} : { interestRatePercent: change.rate }), ...(change.frequency === undefined ? {} : { interestFrequency: change.frequency }) })} onRemove={() => view.removeDraft(draft.id)} />)}
            {view.bucketAccounts.length === 0 && view.drafts.length === 0 && <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">Add at least one account row to start this bucket.</div>}
          </div>
          {view.preview && Math.abs(view.preview.bucketDifference) >= view.epsilon && <FormField label="Account for bucket-total correction" required hint="The correction is posted only to this selected account."><CustomSelect value={view.adjustmentAccountId ?? ''} onChange={value => view.setAdjustmentAccountId(String(value) || null)} options={[{ value: '', label: 'Choose an open account' }, ...view.adjustmentOptions]} ariaLabel="Account for bucket-total correction" className="w-full" /></FormField>}
          {view.preview && view.preview.accountAdjustments.length > 0 && <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/15 p-3.5"><div className="flex items-center gap-2 text-xs font-bold text-foreground"><CheckCircle2 className="size-4 text-accent-ink" aria-hidden="true" />Planned balance changes</div>{view.preview.accountAdjustments.map(account => <div key={account.id} className="flex items-center justify-between gap-3 text-[11px]"><span className="min-w-0 truncate">{account.name}</span><SignedAmount value={account.diff} currency={currency} hideSensitive={hideSensitive} /></div>)}</div>}
        </div>
      </BottomSheet>
      <CustomConfirmModal
        isOpen={Boolean(view.pending)}
        title={view.pending?.preview.bucketDifference && Math.abs(view.pending.preview.bucketDifference) >= view.epsilon ? 'Confirm bucket adjustment' : 'Confirm account setup'}
        confirmText="Apply account setup"
        cancelText="Go back"
        variant="primary"
        message={view.pending && <div className="space-y-3"><p>{view.pending.preview.bucketDifference && Math.abs(view.pending.preview.bucketDifference) >= view.epsilon ? 'The requested account amounts do not match the current bucket total.' : 'The bucket total will stay the same while its amount is assigned across these account rows.'}</p><div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3"><div className="flex items-center justify-between gap-3"><span>Current bucket total</span><span>{formatAmount(view.pending.preview.bucketTotal)}</span></div><div className="flex items-center justify-between gap-3"><span>Target account total</span><span>{formatAmount(view.pending.preview.targetAccountTotal)}</span></div><div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5"><span>Bucket adjustment</span><SignedAmount value={view.pending.preview.bucketDifference} currency={currency} hideSensitive={hideSensitive} /></div></div><p className="text-[10px] text-muted-foreground">This uses explicit account placement and keeps the bucket’s affordability and history unchanged.</p></div>}
        onCancel={view.clearPending}
        onConfirm={() => { void handleConfirm() }}
        isConfirming={isApplying}
        confirmingText="Applying..."
      />
    </>
  )
}
