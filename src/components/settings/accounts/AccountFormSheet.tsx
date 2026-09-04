import { useEffect, useState } from 'react'
import {
  Archive,
  Banknote,
  CircleHelp,
  CreditCard,
  Info,
  Landmark,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { ModalActions } from '../../ui/ModalActions'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import type { LedgerAccount, LedgerAccountKind } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { formatCurrencyVal, maskCurrencyInput } from '../../../lib/utils'
import { ACCOUNT_BUCKET_OPTIONS, ACCOUNT_KIND_OPTIONS } from './accountOptions'

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
  const [isArchived, setIsArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingError, setOpeningError] = useState<string | null>(null)
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
    setIsArchived(account?.isArchived ?? false)
    setError(null)
    setOpeningError(null)
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
      setOpeningError('Enter a valid starting amount.')
      return
    }

    if (isEditing && !account?.isArchived && !isBalanceValid) {
      setBalanceError('Enter a valid balance.')
      return
    }

    setError(null)
    setOpeningError(null)
    setBalanceError(null)
    setIsSaving(true)
    try {
      await onSave({
        name: trimmedName,
        bucket,
        kind,
        openingAmount: isEditing ? undefined : parsedOpening,
        targetBalance: isEditing && isBalanceDirty ? parsedBalance : undefined,
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
        <ModalActions>
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSaving} className="rounded-xl">Cancel</Button>
          <Button variant="primary" type="submit" form="ledger-account-form" disabled={isSaving} className="rounded-xl shadow-md">
            {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Add account'}
          </Button>
        </ModalActions>
      )}
    >
      <form id="ledger-account-form" noValidate onSubmit={submit} className="space-y-4">
        {/* Header summary banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3.5">
          <div className={`grid size-10 shrink-0 place-items-center rounded-xl border ${bucketBadgeClass}`} aria-hidden="true">
            <AccountIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold text-foreground">{isEditing ? 'Update this account' : 'Account connection'}</p>
              {isEditing && isArchived && (
                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-eyebrow uppercase text-muted-foreground">
                  Closed
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isEditing
                ? 'Changes affect this account only. Past transactions stay as they are.'
                : 'Name this account and choose its budget bucket.'}
            </p>
          </div>
        </div>

        {/* Core fields */}
        <div className="space-y-3.5">
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

          <p className="-mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span>One real account can appear once in each bucket if you track its money separately.</span>
          </p>

          {/* Balance Field */}
          {!isEditing ? (
            <FormField
              label={`Balance today (${currency})`}
              error={openingError ?? undefined}
              hint="Optional. If this account holds funds today, balances are confirmed against the bucket total."
            >
              <SmartAmountInput
                value={openingAmount}
                onChange={event => setOpeningAmount(maskCurrencyInput(event.target.value, openingAmount))}
                placeholder="0.00"
              />
            </FormField>
          ) : (
            <div className="space-y-1.5">
              <FormField
                label={`Balance today (${currency})`}
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
                <div className="px-0.5 text-xs">
                  {!isBalanceDirty ? (
                    <span className="text-muted-foreground">Balance unchanged</span>
                  ) : (
                    <span className="font-medium text-accent-ink">
                      Was {formatCurrencyVal(account.remaining, currency)} · {bucket} total becomes {formatCurrencyVal(nextBucketTotal, currency)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Options Section: Lifecycle Status */}
        {isEditing && (
          <div className="space-y-3 pt-1">
            {/* Account Status / Archive Card */}
            <div
              className={`rounded-2xl border transition duration-150 ${
                isArchived
                  ? 'border-border/80 bg-muted/20'
                  : 'border-border/60 bg-muted/10 hover:bg-muted/15'
              }`}
            >
              <label
                className={`flex items-start justify-between gap-3 p-3.5 ${
                  isBalanceDirty
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className={`grid size-9 shrink-0 place-items-center rounded-xl border mt-0.5 transition duration-150 ${
                      isArchived
                        ? 'border-border bg-muted/60 text-foreground'
                        : 'border-border/60 bg-muted/30 text-muted-foreground'
                    }`}
                    aria-hidden="true"
                  >
                    <Archive className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground sm:text-sm">
                        Mark account as closed
                      </span>
                      {isArchived && (
                        <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-eyebrow uppercase text-muted-foreground">
                          Closed
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {isBalanceDirty
                        ? 'Closed accounts cannot change balance. Save the balance correction first.'
                        : 'Closed accounts stay in history but are hidden from new entries.'}
                    </p>
                  </div>
                </div>
                <Checkbox
                  checked={isArchived}
                  onChange={event => setIsArchived(event.target.checked)}
                  disabled={isBalanceDirty}
                  aria-label="Mark account as closed"
                  className="mt-1"
                />
              </label>
            </div>
          </div>
        )}

        {/* Growth Note Callout - only rendered for Growth bucket */}
        {bucket === 'Growth' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
            <p className="leading-relaxed">
              <span className="font-semibold text-foreground">Growth is kept separate.</span> Investment deposits and withdrawals remain the source of truth.
            </p>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
