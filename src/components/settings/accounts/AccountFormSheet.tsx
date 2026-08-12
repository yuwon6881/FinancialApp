import { useEffect, useState } from 'react'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { CustomSelect } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { SmartAmountInput } from '../../ui/SmartAmountInput'
import type { LedgerAccount, LedgerAccountKind } from '../../../types'
import type { LedgerAccountInput } from '../../../app/financialData/accountActions'

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

const BUCKET_OPTIONS: Array<{ value: LedgerAccount['bucket']; label: string }> = [
  { value: 'Essentials', label: 'Essentials' },
  { value: 'Growth', label: 'Growth' },
  { value: 'Stability', label: 'Stability' },
  { value: 'Rewards', label: 'Rewards' },
]

const KIND_OPTIONS: Array<{ value: LedgerAccountKind; label: string }> = [
  { value: 'Bank', label: 'Bank account' },
  { value: 'EWallet', label: 'E-wallet' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
]

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

  return (
    <BottomSheet
      isOpen={isOpen}
      title={isEditing ? 'Edit account' : 'Add account'}
      description="Keep one row for each real-world place where money lives. Each account belongs to one budget bucket."
      onClose={onClose}
      maxWidthClassName="max-w-lg"
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
          <FormField label="Bucket" required hint="One real-world account can have one row in each bucket if you track both separately.">
            <CustomSelect
              value={bucket}
              onChange={setBucket}
              options={BUCKET_OPTIONS}
              ariaLabel="Account bucket"
            />
          </FormField>
          <FormField label="Account type" required>
            <CustomSelect
              value={kind}
              onChange={setKind}
              options={KIND_OPTIONS}
              ariaLabel="Account type"
            />
          </FormField>
        </div>

        {!isEditing && (
          <FormField
            label={`Starting amount (${currency})`}
            hint="This is recorded as an ordinary adjustment. A positive Stability amount also pays down any emergency-fund reload due."
          >
            <SmartAmountInput
              value={openingAmount}
              onChange={event => setOpeningAmount(event.target.value)}
              placeholder="0.00"
            />
          </FormField>
        )}

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-foreground">
            <Checkbox checked={isDefault} onChange={event => setIsDefault(event.target.checked)} />
            Use as the default for this bucket
          </label>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            New bucket activity uses the default when no account is selected. Archiving a default automatically moves the default to the oldest remaining open account.
          </p>
          {!account && hasOpenAccountInBucket && isDefault && (
            <p className="text-[11px] text-muted-foreground">Saving this as default will replace the current default for {bucket}.</p>
          )}
          {isEditing && (
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-foreground">
              <Checkbox checked={isArchived} onChange={event => setIsArchived(event.target.checked)} />
              Mark this account as closed
            </label>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Growth accounts track money sent to investments separately; they are not added to the cash you have. Investment deposits and withdrawals remain the source of truth for that money.
        </p>
      </form>
    </BottomSheet>
  )
}
