import React from 'react'
import type { LedgerAccount, SavingsGoal } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { FormField } from '../ui/FormField'
import { focusFirstInvalidField } from '../ui/formValidation'
import { ModalActions } from '../ui/ModalActions'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { maskCurrencyInput } from '../../lib/utils'
import { roundMoney } from '../../lib/money'

export interface SavingsGoalInterestSheetProps {
  goal: SavingsGoal
  accounts: LedgerAccount[]
  currency: string
  formatSensitive: (value: number) => React.ReactNode
  onClose: () => void
  onConfirm: (amount: number, accountId: string, operationId: string) => Promise<string | null>
}

function createOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const SavingsGoalInterestSheet: React.FC<SavingsGoalInterestSheetProps> = ({
  goal,
  accounts,
  formatSensitive,
  onClose,
  onConfirm,
}) => {
  const bucket = goal.fundingBucket ?? 'Rewards'
  const qualifyingAccounts = accounts.filter(
    account => account.bucket === bucket && !account.isArchived && account.kind !== 'CreditCard',
  )

  const [amountInput, setAmountInput] = React.useState(() => (goal.earmarkedAmount ?? 0).toFixed(2))
  const [accountId, setAccountId] = React.useState(() => (qualifyingAccounts.length === 1 ? qualifyingAccounts[0].id : ''))
  const [serverError, setServerError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const operationIdRef = React.useRef<string | null>(null)
  if (operationIdRef.current == null) {
    operationIdRef.current = createOperationId()
  }

  const parsed = Number.parseFloat(amountInput)
  const isFinite = Number.isFinite(parsed)
  const delta = isFinite ? roundMoney(parsed - goal.earmarkedAmount) : 0

  let amountError: React.ReactNode = undefined
  let amountHint: React.ReactNode = undefined

  if (serverError) {
    amountError = serverError
  } else if (isFinite) {
    if (parsed < goal.earmarkedAmount) {
      amountError = 'That is lower than what is set aside. Use Release money to take some out.'
    } else if (parsed > goal.targetAmount) {
      amountError = <>That is above the target of {formatSensitive(goal.targetAmount)}. Raise the target first.</>
    } else if (parsed > goal.earmarkedAmount) {
      amountHint = <>Interest to add: +{formatSensitive(delta)}</>
    }
  }

  const isWithinTarget = isFinite && parsed <= goal.targetAmount
  const canSubmit = delta > 0 && isWithinTarget && Boolean(accountId) && !busy

  const handleConfirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !canSubmit) return
    const form = event.currentTarget
    setBusy(true)
    try {
      const rejection = await onConfirm(delta, accountId, operationIdRef.current!)
      if (rejection) {
        setServerError(rejection)
        focusFirstInvalidField(form)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      isOpen
      title={`Add interest to ${goal.name}`}
      onClose={onClose}
      maxWidthClassName="max-w-md"
    >
      <form noValidate onSubmit={event => { void handleConfirm(event) }} className="space-y-4 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          Record growth in your pocket. It counts as interest earned in the account you pick, so what you can spend does not change.
        </p>

        <FormField
          label="Amount in this pocket now"
          required
          error={amountError}
          hint={!amountError ? amountHint : undefined}
          hintClassName="text-xs font-medium"
        >
          <SmartAmountInput
            type="text"
            value={amountInput}
            onChange={event => {
              setAmountInput(previous => maskCurrencyInput(event.target.value, previous))
              setServerError('')
            }}
            placeholder="0.00"
            className="font-medium [appearance:textfield]"
          />
        </FormField>

        {qualifyingAccounts.length === 0 ? (
          <p className="text-xs font-medium text-muted-foreground">
            Add an account in the {bucket} bucket first.
          </p>
        ) : (
          <FormField label="Interest goes into" required>
            <CustomSelect
              ariaLabel="Interest goes into"
              value={accountId}
              onChange={value => {
                setAccountId(value)
                setServerError('')
              }}
              options={[
                { value: '', label: 'Choose an account', disabled: true },
                ...qualifyingAccounts.map(account => ({ value: account.id, label: account.name })),
              ]}
              className="w-full"
            />
          </FormField>
        )}

        <ModalActions className="pt-2">
          <Button variant="secondary" className="rounded-xl py-2.5" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-xl py-2.5"
            disabled={!canSubmit}
          >
            Record interest
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
  )
}
