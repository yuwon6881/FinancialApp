import React from 'react'
import type { SavingsGoal } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { maskCurrencyInput } from '../../lib/utils'
import { FormField } from '../ui/FormField'
import { focusFirstInvalidField } from '../ui/formValidation'
import { ModalActions } from '../ui/ModalActions'

export type ContributeMode = 'topUp' | 'release'

interface SavingsGoalContributeSheetProps {
  goal: SavingsGoal
  mode: ContributeMode
  currency: string
  /** Free-to-spend rewards — the ceiling on a top-up. */
  available: number
  /** What this goal needs this cycle, offered as a one-tap suggestion. */
  suggested: number
  formatSensitive: (value: number) => React.ReactNode
  onClose: () => void
  onConfirm: (amount: number) => void
}

/**
 * The manual escape hatch: move a specific amount into or out of one goal's earmark. Automatic
 * per-cycle pacing covers the routine case; this is for windfalls and for raiding one goal to
 * cover another.
 *
 * No money leaves the ledger either way — this only changes which part of the Rewards pool is
 * spoken for.
 */
export const SavingsGoalContributeSheet: React.FC<SavingsGoalContributeSheetProps> = ({
  goal,
  mode,
  currency,
  available,
  suggested,
  formatSensitive,
  onClose,
  onConfirm,
}) => {
  const isTopUp = mode === 'topUp'
  // The most this move can be: free rewards (capped by what the goal still needs) for a top-up, or
  // everything the goal currently holds for a release. Both directions default to one cycle's
  // pace; releasing the entire commitment remains available by entering that amount explicitly.
  const ceiling = isTopUp
    ? Math.min(available, Math.max(0, goal.targetAmount - goal.earmarkedAmount))
    : goal.earmarkedAmount
  const defaultAmount = Math.min(ceiling, suggested > 0 ? suggested : ceiling)

  const [amountInput, setAmountInput] = React.useState(() => (defaultAmount > 0 ? defaultAmount.toFixed(2) : ''))
  const [error, setError] = React.useState('')

  const parsed = Number.parseFloat(amountInput)

  const handleConfirm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Amount is required.')
      focusFirstInvalidField(event.currentTarget)
      return
    }
    if (parsed > ceiling + 0.005) {
      setError(isTopUp
        ? 'That is more than your free rewards can cover.'
        : 'That is more than this goal is holding.')
      focusFirstInvalidField(event.currentTarget)
      return
    }
    // Sign carries the direction: the server treats negative as a release.
    onConfirm(isTopUp ? parsed : -parsed)
  }

  return (
    <BottomSheet
      isOpen
      title={isTopUp ? 'Top Up This Goal' : 'Release From This Goal'}
      onClose={onClose}
      maxWidthClassName="max-w-md"
    >
      <form noValidate onSubmit={handleConfirm} className="space-y-4 py-2">
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-foreground truncate">{goal.name}</h4>
            <span className="text-xs text-muted-foreground font-medium">
              {formatSensitive(goal.earmarkedAmount)} of {formatSensitive(goal.targetAmount)} set aside
            </span>
          </div>
        </div>

        <FormField
          label={`Amount (${currency})`}
          required
          error={error}
          hint={!error
            ? (isTopUp
                ? <>Up to {formatSensitive(ceiling)} available from your free rewards.</>
                : <>Up to {formatSensitive(ceiling)} can go back to your free rewards.</>)
            : undefined}
          hintClassName="text-[11px] font-medium"
        >
          <SmartAmountInput
            type="text"
            value={amountInput}
            onChange={event => {
              setAmountInput(previous => maskCurrencyInput(event.target.value, previous))
              setError('')
            }}
            placeholder="0.00"
            className="font-medium [appearance:textfield]"
          />
        </FormField>

        <p className="text-[11px] text-muted-foreground font-medium">
          This only changes which part of your rewards is spoken for — no transaction is added to your ledger.
        </p>

        <ModalActions className="pt-2">
          <Button variant="outline" className="rounded-xl py-2.5" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-xl py-2.5"
          >
            {isTopUp ? 'Set Aside' : 'Release'}
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
  )
}
