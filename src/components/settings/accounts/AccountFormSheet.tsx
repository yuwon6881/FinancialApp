import { useEffect, useState } from 'react'
import { Archive, CircleHelp } from 'lucide-react'
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
import { cardOwed, isCreditCardKind } from '../../../lib/creditCards'
import { formatCurrencyVal, maskCurrencyInput } from '../../../lib/utils'
import { ACCOUNT_KIND_ICONS, accountBucketOptionsFor, accountKindOptionsFor } from './accountOptions'

export interface AccountFormSaveInput extends LedgerAccountInput {
  targetBalance?: number
}
interface AccountFormSheetProps {
  isOpen: boolean
  account: LedgerAccount | null
  /**
   * Every account the user already has, in any bucket and including closed ones. The server holds
   * account names unique per user across the whole ledger, so the name check needs the full list,
   * not `bucketAccounts`.
   */
  existingAccounts?: readonly LedgerAccount[]
  bucketAccounts?: LedgerAccount[]
  bucketTotal?: number
  defaultBucket?: LedgerAccount['bucket']
  defaultKind?: LedgerAccountKind
  currency: string
  onClose: () => void
  onSave: (input: AccountFormSaveInput) => Promise<void> | void
}

const parseField = (value: string) => value.trim() ? Number(value) : Number.NaN

// A card's balance field reads as what is owed, so the stored balance is its negation. Switching a
// row in or out of the card kind re-expresses the same balance rather than flipping its sign.
const toSigned = (field: number, isCard: boolean) => isCard ? 0 - field : field
const toField = (signed: number, isCard: boolean) => toSigned(signed, isCard).toFixed(2)

export function AccountFormSheet({
  isOpen,
  account,
  existingAccounts,
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
  const [creditLimitAmount, setCreditLimitAmount] = useState('')
  const [isArchived, setIsArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingError, setOpeningError] = useState<string | null>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [creditLimitError, setCreditLimitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isEditing = Boolean(account)
  const isCard = isCreditCardKind(kind)

  useEffect(() => {
    if (!isOpen) return
    const initialKind = account?.kind ?? defaultKind
    setName(account?.name ?? '')
    setBucket(account?.bucket ?? defaultBucket)
    setKind(initialKind)
    setOpeningAmount('')
    setBalanceAmount(account ? toField(account.remaining, isCreditCardKind(initialKind)) : '')
    setCreditLimitAmount(typeof account?.creditLimit === 'number' ? account.creditLimit.toFixed(2) : '')
    setIsArchived(account?.isArchived ?? false)
    setError(null)
    setOpeningError(null)
    setBalanceError(null)
    setCreditLimitError(null)
  }, [account, defaultBucket, defaultKind, isOpen])

  const changeKind = (nextKind: LedgerAccountKind) => {
    const wasCard = isCreditCardKind(kind)
    const willBeCard = isCreditCardKind(nextKind)
    if (wasCard !== willBeCard) {
      const balance = parseField(balanceAmount)
      if (Number.isFinite(balance)) setBalanceAmount(toField(toSigned(balance, wasCard), willBeCard))
      const opening = parseField(openingAmount)
      if (Number.isFinite(opening)) setOpeningAmount(toField(toSigned(opening, wasCard), willBeCard))
    }
    setKind(nextKind)
  }

  const parsedBalanceField = parseField(balanceAmount)
  // A card may sit in credit, so only a non-card balance is held at zero or above.
  const isBalanceValid = Number.isFinite(parsedBalanceField) && (isCard || parsedBalanceField >= 0)
  const parsedBalance = isBalanceValid ? toSigned(parsedBalanceField, isCard) : Number.NaN
  const balanceDiff = isBalanceValid && account ? parsedBalance - account.remaining : 0
  const isBalanceDirty = isEditing && !account?.isArchived && isBalanceValid && Math.abs(balanceDiff) >= 0.005
  const owesOnCard = Boolean(account && !account.isArchived && cardOwed(account) > 0)
  const isArchiveBlocked = isBalanceDirty || (isCard && owesOnCard)

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

    // The server holds names unique per user and answers a clash with a 409. Account writes go
    // through the outbox, so that 409 arrives long after this sheet has closed -- and during the
    // first-run coverage gate there is no toast surface mounted to carry it at all. Answering it
    // here keeps the verdict on the field that caused it, and works offline besides.
    const duplicate = existingAccounts?.find(candidate =>
      candidate.id !== account?.id
      && candidate.name.trim().toLowerCase() === trimmedName.toLowerCase())
    if (duplicate) {
      setError(duplicate.isArchived
        ? `"${duplicate.name}" already exists as a closed account. Reopen it instead, or pick another name.`
        : 'An account with this name already exists. Pick another name.')
      return
    }

    const parsedOpeningField = openingAmount.trim() ? Number(openingAmount) : 0
    if (!isEditing && (!Number.isFinite(parsedOpeningField) || parsedOpeningField < 0)) {
      setOpeningError(parsedOpeningField < 0
        ? (isCard ? 'Amount owed cannot be negative.' : 'Starting amount cannot be negative.')
        : 'Enter a valid starting amount.')
      return
    }

    if (isEditing && !account?.isArchived && !isBalanceValid) {
      setBalanceError(Number.isFinite(parsedBalanceField) ? 'Account balance cannot be negative.' : 'Enter a valid balance.')
      return
    }

    const parsedLimit = creditLimitAmount.trim() ? Number(creditLimitAmount) : null
    if (isCard && parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      setCreditLimitError('Enter a credit limit above zero, or leave it blank.')
      return
    }

    setError(null)
    setOpeningError(null)
    setBalanceError(null)
    setCreditLimitError(null)
    setIsSaving(true)
    try {
      await onSave({
        name: trimmedName,
        bucket,
        kind,
        openingAmount: isEditing ? undefined : toSigned(parsedOpeningField, isCard),
        targetBalance: isEditing && isBalanceDirty ? parsedBalance : undefined,
        isArchived,
        // The server drops the limit itself when an account stops being a card.
        ...(isCard ? { creditLimit: parsedLimit } : {}),
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const AccountIcon = ACCOUNT_KIND_ICONS[kind] ?? CircleHelp
  const bucketBadgeClass = getCategoryBadgeClass(bucket)
  const balanceLabel = isCard ? `Owed today (${currency})` : `Balance today (${currency})`

  return (
    <BottomSheet
      isOpen={isOpen}
      title={isEditing ? 'Edit account' : 'Add account'}
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
            {isCard && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Purchases count as spending when you make them. Paying the card later is a move between your accounts, not new spending.
              </p>
            )}
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
              hint={isBalanceDirty
                ? 'Move this account to another bucket on its own, then correct the balance.'
                : isCard ? 'Credit cards sit in Essentials or Rewards.' : undefined}
            >
              <CustomSelect
                value={bucket}
                onChange={setBucket}
                options={accountBucketOptionsFor(kind)}
                ariaLabel="Account bucket"
                disabled={isBalanceDirty}
                className="w-full"
              />
            </FormField>
            <FormField label="Account type" required>
              <CustomSelect
                value={kind}
                onChange={changeKind}
                options={accountKindOptionsFor(bucket)}
                ariaLabel="Account type"
                className="w-full"
              />
            </FormField>
          </div>


          {/* Balance Field */}
          {!isEditing ? (
            <FormField
              label={balanceLabel}
              error={openingError ?? undefined}
              hint={isCard ? 'What you currently owe on this card. Leave it at 0 if it is paid off.' : undefined}
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
                label={balanceLabel}
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
                    <span className="text-muted-foreground">{isCard ? 'Amount owed unchanged' : 'Balance unchanged'}</span>
                  ) : (
                    <span className="font-medium text-accent-ink">
                      {isCard
                        ? `Was owing ${formatCurrencyVal(Math.max(0, -account.remaining), currency)}`
                        : `Was ${formatCurrencyVal(account.remaining, currency)}`} · {bucket} total becomes {formatCurrencyVal(nextBucketTotal, currency)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {isCard && (
            <FormField
              label={`Credit limit (${currency})`}
              error={creditLimitError ?? undefined}
              hint="Optional. Shows how much room is left on the card. It is never counted as money you have."
            >
              <SmartAmountInput
                value={creditLimitAmount}
                onChange={event => setCreditLimitAmount(maskCurrencyInput(event.target.value, creditLimitAmount))}
                placeholder="No limit recorded"
              />
            </FormField>
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
                  isArchiveBlocked
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
                        ? 'Save the balance correction first.'
                        : isCard && owesOnCard
                          ? 'Pay off this card before closing it.'
                          : 'Hidden from new entries.'}
                    </p>
                  </div>
                </div>
                <Checkbox
                  checked={isArchived}
                  onChange={event => setIsArchived(event.target.checked)}
                  disabled={isArchiveBlocked}
                  aria-label="Mark account as closed"
                  className="mt-1"
                />
              </label>
            </div>
          </div>
        )}

      </form>
    </BottomSheet>
  )
}
