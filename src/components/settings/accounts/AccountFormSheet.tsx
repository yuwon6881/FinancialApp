import { useEffect, useState } from 'react'
import { Banknote, Building2, CircleHelp, CreditCard, Info, Landmark, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import type { LedgerAccount, LedgerAccountKind } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'
import { getCategoryBadgeClass } from '../../../lib/categoryColors'
import { maskCurrencyInput } from '../../../lib/utils'
import { ACCOUNT_BUCKET_OPTIONS, ACCOUNT_KIND_OPTIONS } from './accountOptions'

interface AccountFormSheetProps {
  isOpen: boolean
  account: LedgerAccount | null
  existingAccounts?: LedgerAccount[]
  defaultBucket?: LedgerAccount['bucket']
  defaultKind?: LedgerAccountKind
  defaultIsDefault?: boolean
  currency: string
  onClose: () => void
  onSave: (input: LedgerAccountInput) => Promise<void> | void
}

const KIND_ICONS: Record<LedgerAccountKind, LucideIcon> = {
  Bank: Landmark,
  EWallet: Wallet,
  Cash: Banknote,
  Card: CreditCard,
}

export function AccountFormSheet({
  isOpen,
  account,
  existingAccounts = [],
  defaultBucket = 'Essentials',
  defaultKind = 'Bank',
  defaultIsDefault = false,
  currency,
  onClose,
  onSave,
}: AccountFormSheetProps) {
  const [name, setName] = useState('')
  const [bucket, setBucket] = useState<LedgerAccount['bucket']>(defaultBucket)
  const [kind, setKind] = useState<LedgerAccountKind>(defaultKind)
  const [openingAmount, setOpeningAmount] = useState('')
  const [isDefault, setIsDefault] = useState(defaultIsDefault)
  const [isArchived, setIsArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const hasOpenAccountInBucket = existingAccounts.some(item =>
    item.bucket === bucket && !item.isArchived && item.id !== account?.id,
  )

  useEffect(() => {
    if (!isOpen) return
    setName(account?.name ?? '')
    setBucket(account?.bucket ?? defaultBucket)
    setKind(account?.kind ?? defaultKind)
    setOpeningAmount('')
    setIsDefault(account?.isDefault ?? (!existingAccounts.some(item =>
      item.bucket === (account?.bucket ?? defaultBucket) && !item.isArchived,
    ) || defaultIsDefault))
    setIsArchived(account?.isArchived ?? false)
    setError(null)
  }, [account, defaultBucket, defaultIsDefault, defaultKind, existingAccounts, isOpen])

  useEffect(() => {
    if (isOpen && !account && !hasOpenAccountInBucket) setIsDefault(true)
  }, [account, hasOpenAccountInBucket, isOpen])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter an account name.')
      return
    }
    const parsedOpening = openingAmount.trim() ? Number(openingAmount) : 0
    if (!Number.isFinite(parsedOpening)) {
      setError('Enter a valid starting amount.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await onSave({
        name: trimmedName,
        bucket,
        kind,
        openingAmount: account ? undefined : parsedOpening,
        isDefault,
        isArchived,
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const isEditing = Boolean(account)
  const AccountIcon = KIND_ICONS[kind]
  const bucketBadgeClass = getCategoryBadgeClass(bucket)

  return (
    <BottomSheet
      isOpen={isOpen}
      title={isEditing ? 'Edit account' : 'Add account'}
      description="Keep one row for each real-world place where money lives. Each row belongs to one budget bucket."
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
      <form id="ledger-account-form" noValidate onSubmit={submit} className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3.5">
          <div className={`grid size-10 shrink-0 place-items-center rounded-xl border ${bucketBadgeClass}`} aria-hidden="true">
            <AccountIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">{isEditing ? 'Update this account connection' : 'Give this account a clear name'}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {isEditing ? 'Changes affect this bucket row only; your ledger history stays intact.' : 'Use a name you will recognise when choosing an account for new activity.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-border/40 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Building2 className="size-3.5 text-accent-ink" aria-hidden="true" />
          Account details
        </div>

        <FormField label="Account name" required error={error ?? undefined} hint="For example, Main bank account or Wallet cash.">
          <Input
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="Name this account"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Bucket" required>
            <CustomSelect
              value={bucket}
              onChange={setBucket}
              options={ACCOUNT_BUCKET_OPTIONS}
              ariaLabel="Account bucket"
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
          One real-world account can have one row in each bucket if you track both portions separately.
        </p>

        {!isEditing && (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <Banknote className="size-4 text-accent-ink" aria-hidden="true" />
              <p className="text-xs font-bold text-foreground">Starting balance</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Optional. Use this when the account already holds money today.</p>
            <FormField
              label={`Starting amount (${currency})`}
              className="mt-3"
              hint="Recorded as an ordinary adjustment. A positive Stability amount also pays down any emergency-fund reload due."
            >
              <SmartAmountInput
                value={openingAmount}
                onChange={event => setOpeningAmount(maskCurrencyInput(event.target.value, openingAmount))}
                placeholder="0.00"
              />
            </FormField>
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-foreground">
            <Checkbox checked={isDefault} onChange={event => setIsDefault(event.target.checked)} className="mt-0.5 size-5" />
            <span className="min-w-0">
              <span className="block">Use as the default for {bucket}</span>
              <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">New bucket activity uses this account when no account is selected.</span>
            </span>
          </label>
          {!account && hasOpenAccountInBucket && isDefault && (
            <p className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-2 text-[11px] leading-relaxed text-accent-ink">Saving this as default will replace the current default for {bucket}.</p>
          )}
          {isEditing && (
            <label className="flex cursor-pointer items-start gap-3 border-t border-border/40 pt-3 text-sm font-semibold text-foreground">
              <Checkbox checked={isArchived} onChange={event => setIsArchived(event.target.checked)} className="mt-0.5 size-5" />
              <span className="min-w-0">
                <span className="block">Mark this account as closed</span>
                <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">Closed accounts stay visible for history but are no longer offered for new activity.</span>
              </span>
            </label>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p><span className="font-semibold text-foreground">Growth is kept separate.</span> Money sent to investments is not added to your available cash here; investment deposits and withdrawals remain the source of truth.</p>
        </div>
      </form>
    </BottomSheet>
  )
}
