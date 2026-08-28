import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Plus, Trash2 } from 'lucide-react'
import type { LedgerAccount, LedgerAccountKind } from '../../../types'
import type { LedgerAccountReconcileInput } from '../../../lib/api/accounts'
import { formatCurrencyVal } from '../../../lib/utils'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
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
  onReconcileAccounts: (input: LedgerAccountReconcileInput) => Promise<void> | void
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
  onChange,
  onTargetChange,
  onRemove,
}: {
  draft: BucketSetupDraftAccount
  currency: string
  error?: string
  targetError?: string
  onChange: (change: Partial<Omit<BucketSetupDraftAccount, 'id'>>) => void
  onTargetChange: (rawValue: string) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-accent-ink/20 bg-accent/10 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-foreground">New account row</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Add a real account where this bucket’s money lives.</p>
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
  onReconcileAccounts,
}: BucketAccountSetupSheetProps) {
  const view = useBucketAccountSetupView({ isOpen, bucket, accounts, bucketTotal, initialDraft })
  const isBusy = disabled || hideSensitive
  const [isApplying, setIsApplying] = useState(false)
  const operationIdRef = useRef<string | null>(null)

  const handleConfirm = async () => {
    if (!view.pending || !bucket) return
    const pending = view.pending
    setIsApplying(true)
    try {
        const draftsById = new Map(pending.drafts.map(draft => [draft.id, draft]))
        const targets = pending.preview.lines.map(line => {
          const draft = draftsById.get(line.id)
          const account = accounts.find(candidate => candidate.id === line.id)
          return {
            id: line.id,
            name: line.name,
            kind: draft?.kind ?? account?.kind ?? 'Other',
            isArchived: line.isArchived,
            ...(account ? {
              expectedName: account.name,
              expectedKind: account.kind,
              expectedIsArchived: account.isArchived,
            } : {}),
            expectedCurrent: line.current,
            target: line.target,
          }
        })
        const operationId = operationIdRef.current ?? `reconcile-${bucket.toLowerCase()}-${Date.now()}`
        operationIdRef.current = operationId
        await onReconcileAccounts({
          operationId,
          bucket,
          expectedBucketTotal: pending.preview.bucketTotal,
          targets,
        })
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
        title={bucket ? `Update your ${bucket} account balances` : 'Update account balances'}
        description="Enter what each account holds today. Nothing changes until you confirm."
        onClose={onClose}
        maxWidthClassName="max-w-2xl"
        footer={<ModalActions><Button variant="outline" type="button" onClick={onClose} disabled={isBusy}>Cancel</Button><Button type="button" onClick={view.prepareReview} disabled={isBusy || !view.canReview}>Review changes</Button></ModalActions>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3"><span className="block text-xs font-semibold text-muted-foreground">Current bucket total</span><span className="mt-1 block text-sm">{formatAmount(bucketTotal)}</span></div>
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3"><span className="block text-xs font-semibold text-muted-foreground">Current account total</span><span className="mt-1 block text-sm">{view.preview ? formatAmount(view.preview.currentAccountTotal) : 'Enter balances'}</span></div>
            <div className={`rounded-xl border p-3 ${view.preview?.bucketDifference && Math.abs(view.preview.bucketDifference) >= view.epsilon ? 'border-accent-ink/30 bg-accent/15' : 'border-border/60 bg-muted/15'}`}><span className="block text-xs font-semibold text-muted-foreground">Change to {bucket ?? 'bucket'} total</span><span className="mt-1 block text-sm">{view.preview ? <SignedAmount value={view.preview.bucketDifference} currency={currency} hideSensitive={hideSensitive} /> : 'Enter balances'}</span></div>
          </div>
          {view.errors.form && <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><p>{view.errors.form}</p></div>}
          <div className="flex items-start gap-2.5 rounded-xl border border-accent-ink/20 bg-accent/15 p-3 text-xs leading-relaxed text-muted-foreground"><CircleHelp className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" /><p>Enter each account’s balance. Every changed account gets its own ledger adjustment, and the bucket total changes by the net of those account changes.</p></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-bold text-foreground">Accounts in {bucket}</h4><p className="mt-0.5 text-xs text-muted-foreground">Closed accounts stay visible for history.</p></div><Button variant="outline" size="sm" type="button" onClick={view.addDraft} disabled={isBusy}><Plus className="size-3.5" aria-hidden="true" />Add account</Button></div>
            {view.bucketAccounts.map(account => <div key={account.id} className="grid grid-cols-1 items-center gap-2.5 rounded-2xl border border-border/60 bg-card/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)] sm:gap-3"><div className="min-w-0"><p className={`truncate text-xs font-semibold ${account.isArchived ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{account.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{account.isArchived ? 'Closed account · kept for history' : 'Open account'}</p></div>{account.isArchived ? <div className="text-right text-xs">{formatAmount(account.remaining)}</div> : <FormField label={`Current balance for ${account.name}`} error={view.errors[account.id]}><SmartAmountInput value={view.targetInputs[account.id] ?? ''} onChange={event => view.updateTarget(account.id, event.target.value)} placeholder="0.00" /></FormField>}</div>)}
            {view.drafts.map(draft => <NewAccountRow key={draft.id} draft={draft} currency={currency} error={view.errors[draft.id]} targetError={view.errors[`${draft.id}-target`]} onChange={change => view.updateDraft(draft.id, change)} onTargetChange={value => view.updateDraftTarget(draft.id, value)} onRemove={() => view.removeDraft(draft.id)} />)}
            {view.bucketAccounts.length === 0 && view.drafts.length === 0 && <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">Add at least one account row to start this bucket.</div>}
          </div>
          {view.preview && view.preview.accountAdjustments.length > 0 && <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/15 p-3.5"><div className="flex items-center gap-2 text-xs font-bold text-foreground"><CheckCircle2 className="size-4 text-accent-ink" aria-hidden="true" />Planned balance changes</div>{view.preview.accountAdjustments.map(account => <div key={account.id} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate">{account.name}</span><SignedAmount value={account.diff} currency={currency} hideSensitive={hideSensitive} /></div>)}</div>}
        </div>
      </BottomSheet>
      <CustomConfirmModal
        isOpen={Boolean(view.pending)}
        title={view.pending?.preview.bucketDifference && Math.abs(view.pending.preview.bucketDifference) >= view.epsilon ? 'Confirm bucket adjustment' : 'Confirm account setup'}
        confirmText="Apply account setup"
        cancelText="Go back"
        variant="primary"
        message={view.pending && <div className="space-y-3"><p>Each changed account will receive its own ledger adjustment. The bucket total will become the sum of the account balances below.</p><div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3"><div className="flex items-center justify-between gap-3"><span>Current bucket total</span><span>{formatAmount(view.pending.preview.bucketTotal)}</span></div><div className="flex items-center justify-between gap-3"><span>Target account total</span><span>{formatAmount(view.pending.preview.targetAccountTotal)}</span></div><div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5"><span>Net bucket change</span><SignedAmount value={view.pending.preview.bucketDifference} currency={currency} hideSensitive={hideSensitive} /></div></div><p className="text-xs text-muted-foreground">A real transfer between accounts remains a separate Transfer entry in the Ledger.</p></div>}
        onCancel={view.clearPending}
        onConfirm={() => { void handleConfirm() }}
        isConfirming={isApplying}
        confirmingText="Applying..."
      />
    </>
  )
}
