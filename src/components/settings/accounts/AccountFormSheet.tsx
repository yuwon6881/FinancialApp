import { useEffect, useState } from 'react'
import { Banknote, Building2, CircleHelp, CreditCard, Info, Landmark, Percent, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import type { LedgerAccount, LedgerAccountInterestFrequency, LedgerAccountKind } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { formatCurrencyVal, maskCurrencyInput } from '../../../lib/utils'
import { ACCOUNT_BUCKET_OPTIONS, ACCOUNT_INTEREST_FREQUENCY_OPTIONS, ACCOUNT_KIND_OPTIONS } from './accountOptions'

export interface AccountFormSaveInput extends LedgerAccountInput {
  targetBalance?: number
}

interface AccountFormSheetProps {
  isOpen: boolean
  account: LedgerAccount | null
  bucketAccounts?: LedgerAccount[]
  bucketTotal?: number
  defaultBucket?: LedgerAccount['bucket']
  defaultKind?: LedgerAccountKind
  currency: string
  onClose: () => void
  onSave: (input: AccountFormSaveInput) => Promise<void> | void
}

const KIND_ICONS: Record<LedgerAccountKind, LucideIcon> = {
  Bank: Landmark,
  EWallet: Wallet,
  Cash: Banknote,
  Card: CreditCard,
  Other: CircleHelp,
}

export function AccountFormSheet({
  isOpen,
  account,
  bucketAccounts,
  bucketTotal,
  defaultBucket = 'Essentials',
  defaultKind = 'Bank',
  currency,
  onClose,
  onSave,
}: AccountFormSheetProps) {
  const [name, setName] = useState('')
  const [bucket, setBucket] = useState<LedgerAccount['bucket']>(defaultBucket)
  const [kind, setKind] = useState<LedgerAccountKind>(defaultKind)
  const [openingAmount, setOpeningAmount] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [interestEnabled, setInterestEnabled] = useState(false)
  const [interestRatePercent, setInterestRatePercent] = useState('')
  const [interestFrequency, setInterestFrequency] = useState<LedgerAccountInterestFrequency>('Monthly')
  const [isArchived, setIsArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interestError, setInterestError] = useState<string | null>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isEditing = Boolean(account)

  useEffect(() => {
    if (!isOpen) return
    setName(account?.name ?? '')
    setBucket(account?.bucket ?? defaultBucket)
    setKind(account?.kind ?? defaultKind)
    setOpeningAmount('')
    setBalanceAmount(account ? account.remaining.toFixed(2) : '')
    setInterestEnabled(account?.interestEnabled ?? false)
    setInterestRatePercent(account?.interestEnabled ? String(account.interestRatePercent ?? '') : '')
    setInterestFrequency(account?.interestFrequency ?? 'Monthly')
    setIsArchived(account?.isArchived ?? false)
    setError(null)
    setInterestError(null)
    setBalanceError(null)
  }, [account, defaultBucket, defaultKind, isOpen])

  const parsedBalance = balanceAmount.trim() ? Number(balanceAmount) : Number.NaN
  const isBalanceValid = Number.isFinite(parsedBalance)
  const balanceDiff = isBalanceValid && account ? parsedBalance - account.remaining : 0
  const isBalanceDirty = isEditing && !account?.isArchived && isBalanceValid && Math.abs(balanceDiff) >= 0.005

  const effectiveBucketTotal = bucketTotal ?? (
    bucketAccounts
      ? bucketAccounts.reduce((sum, item) => sum + item.remaining, 0)
      : (account ? account.remaining : 0)
  )
  const nextBucketTotal = effectiveBucketTotal + balanceDiff

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter an account name.')
      return
    }

    const parsedOpening = openingAmount.trim() ? Number(openingAmount) : 0
    if (!isEditing && !Number.isFinite(parsedOpening)) {
      setError('Enter a valid starting amount.')
      return
    }

    if (isEditing && !account?.isArchived && !isBalanceValid) {
      setBalanceError('Enter a valid balance.')
      return
    }

    const parsedInterestRate = interestRatePercent.trim() ? Number(interestRatePercent) : 0
    if (interestEnabled && (!Number.isFinite(parsedInterestRate) || parsedInterestRate <= 0 || parsedInterestRate > 100)) {
      setInterestError('Enter an annual interest rate between 0.01% and 100%, or choose no interest.')
      return
    }

    setError(null)
    setInterestError(null)
    setBalanceError(null)
    setIsSaving(true)
    try {
      await onSave({
        name: trimmedName,
        bucket,
        kind,
        openingAmount: isEditing ? undefined : parsedOpening,
        targetBalance: isEditing && isBalanceDirty ? parsedBalance : undefined,
        interestEnabled,
        interestRatePercent: interestEnabled ? Math.round(parsedInterestRate * 10000) / 10000 : 0,
        interestFrequency,
        isArchived,
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const AccountIcon = KIND_ICONS[kind] ?? CircleHelp
  const bucketBadgeClass = getCategoryBadgeClass(bucket)

  return (
    <BottomSheet
      isOpen={isOpen}
      title={isEditing ? 'Edit account' : 'Add account'}
      description="Connect where money lives to a budget bucket."
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" type="submit" form="ledger-account-form" disabled={isSaving}>
            {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      )}
    >
      <form id="ledger-account-form" noValidate onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3.5">
          <div className={`grid size-10 shrink-0 place-items-center rounded-xl border ${bucketBadgeClass}`} aria-hidden="true">
            <AccountIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">{isEditing ? 'Update this account' : 'Account connection'}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {isEditing
                ? 'Changes affect this account only. Past transactions stay as they are.'
                : 'Name this account and choose its budget bucket.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Building2 className="size-3.5 text-accent-ink" aria-hidden="true" />
          Account details
        </div>

        <FormField label="Account name" required error={error ?? undefined} hint="e.g. Main bank account or Cash wallet">
          <Input
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="Name this account"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
          <FormField
            label="Bucket"
            required
            hint={isBalanceDirty ? 'Move this account to another bucket on its own, then correct the balance.' : undefined}
          >
            <CustomSelect
              value={bucket}
              onChange={setBucket}
              options={ACCOUNT_BUCKET_OPTIONS}
              ariaLabel="Account bucket"
              disabled={isBalanceDirty}
              className="w-full"
            />
          </FormField>
          <FormField label="Account type" required>
            <CustomSelect
              value={kind}
              onChange={setKind}
              options={ACCOUNT_KIND_OPTIONS}
              ariaLabel="Account type"
              className="w-full"
            />
          </FormField>
        </div>

        <p className="-mt-1 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          One real account can appear once in each bucket if you track its money separately.
        </p>

        {/* Balance Block */}
        {!isEditing ? (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-accent-ink" aria-hidden="true" />
              <p className="text-xs font-bold text-foreground">Balance today</p>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Optional. If this account holds funds today, balances are confirmed against the bucket total.</p>
            <FormField
              label={`Balance today (${currency})`}
              className="mt-3"
              hint="Entered like ledger amounts. Any required adjustment is confirmed first."
            >
              <SmartAmountInput
                value={openingAmount}
                onChange={event => setOpeningAmount(maskCurrencyInput(event.target.value, openingAmount))}
                placeholder="0.00"
              />
            </FormField>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-accent-ink" aria-hidden="true" />
              <p className="text-xs font-bold text-foreground">Account balance</p>
            </div>
            <FormField
              label={`Balance today (${currency})`}
              className="mt-3"
              error={balanceError ?? undefined}
              hint={account?.isArchived ? 'Reopen this account to correct its balance.' : undefined}
            >
              <SmartAmountInput
                value={balanceAmount}
                onChange={event => setBalanceAmount(maskCurrencyInput(event.target.value, balanceAmount))}
                placeholder="0.00"
                disabled={account?.isArchived}
              />
            </FormField>
            {account && !account.isArchived && (
              <div className="mt-2 text-[11px]">
                {!isBalanceDirty ? (
                  <span className="text-muted-foreground">Balance unchanged</span>
                ) : (
                  <span className="font-medium text-foreground">
                    Was {formatCurrencyVal(account.remaining, currency)} · {bucket} total becomes {formatCurrencyVal(nextBucketTotal, currency)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-3.5 sm:p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-foreground">
            <Checkbox checked={interestEnabled} onChange={event => setInterestEnabled(event.target.checked)} className="mt-0.5 size-5" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5"><Percent className="size-3.5 text-accent-ink" aria-hidden="true" />Earn interest on this account</span>
              <span className="mt-0.5 block text-[11px] font-normal leading-relaxed text-muted-foreground">Interest is added as a ledger credit to this account and {bucket}.</span>
            </span>
          </label>
          {interestEnabled && (
            <div className="grid grid-cols-1 gap-3.5 border-t border-border/40 pt-3 sm:grid-cols-2 sm:gap-4">
              <FormField label="Annual interest rate (%)" required error={interestError ?? undefined} hint="e.g. 5 for 5% per year.">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="100"
                  step="0.0001"
                  value={interestRatePercent}
                  onChange={event => setInterestRatePercent(event.target.value)}
                  placeholder="5"
                />
              </FormField>
              <FormField label="Add interest" required hint="Posting frequency">
                <CustomSelect
                  value={interestFrequency}
                  onChange={setInterestFrequency}
                  options={ACCOUNT_INTEREST_FREQUENCY_OPTIONS}
                  ariaLabel="Interest posting frequency"
                  className="w-full"
                />
              </FormField>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-3.5 sm:p-4">
            <label className={`flex items-start gap-3 text-sm font-semibold ${isBalanceDirty ? 'opacity-60 cursor-not-allowed text-muted-foreground' : 'cursor-pointer text-foreground'}`}>
              <Checkbox
                checked={isArchived}
                onChange={event => setIsArchived(event.target.checked)}
                disabled={isBalanceDirty}
                className="mt-0.5 size-5"
              />
              <span className="min-w-0">
                <span className="block">Mark account as closed</span>
                <span className="mt-0.5 block text-[11px] font-normal leading-relaxed text-muted-foreground">
                  {isBalanceDirty
                    ? 'Closed accounts cannot change balance. Save the balance correction first.'
                    : 'Closed accounts stay in history but are hidden from new entries.'}
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p><span className="font-semibold text-foreground">Growth is kept separate.</span> Investment deposits and withdrawals remain the source of truth.</p>
        </div>
      </form>
    </BottomSheet>
  )
}
