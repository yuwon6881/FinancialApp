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
  /** Free-to-spend bucket money — the ceiling on a top-up. */
  available: number
  /** What remains outstanding for this goal this cycle, offered for a top-up. */
  suggestedTopUp: number
  /** The current cycle's nominal pace, offered for a release. */
  suggestedRelease: number
  formatSensitive: (value: number) => React.ReactNode
  onClose: () => void
  /**
   * Resolves to the server's rejection message when the move was refused, or
   * null once it succeeded. The sheet stays open on refusal so the reason is
   * readable on the field rather than behind the sheet.
   */
  onConfirm: (amount: number) => Promise<string | null> | void
}

/**
 * The manual escape hatch: move a specific amount into or out of one goal's earmark. Automatic
 * per-cycle pacing covers the routine case; this is for windfalls and for raiding one goal to
 * cover another.
 *
 * No money leaves the ledger either way — this only changes which part of the bucket pool is
 * spoken for.
 */
export const SavingsGoalContributeSheet: React.FC<SavingsGoalContributeSheetProps> = ({
  goal,
  mode,
  currency,
  available,
  suggestedTopUp,
  suggestedRelease,
  formatSensitive,
  onClose,
  onConfirm,
}) => {
  const isTopUp = mode === 'topUp'
  const fundingBucket = goal.fundingBucket ?? 'Rewards'
  const bucketLabel = fundingBucket.toLowerCase()
  // The most this move can be: free rewards (capped by what the goal still needs) for a top-up, or
  // everything the goal currently holds for a release. Both directions normally default to one
  // cycle's pace; a top-up with no outstanding pace stays blank, while full release remains
  // available by entering that amount explicitly.
  const ceiling = isTopUp
    ? Math.min(available, Math.max(0, goal.targetAmount - goal.earmarkedAmount))
    : goal.earmarkedAmount
  const suggested = isTopUp ? suggestedTopUp : suggestedRelease
  // A top-up with no outstanding pace should not silently suggest the entire remaining goal.
  // Release keeps its historical fallback of offering the whole earmark when no cycle pace exists.
  const defaultAmount = isTopUp
    ? Math.min(ceiling, Math.max(0, suggested))
    : Math.min(ceiling, suggested > 0 ? suggested : ceiling)

  const [amountInput, setAmountInput] = React.useState(() => (defaultAmount > 0 ? defaultAmount.toFixed(2) : ''))
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const parsed = Number.parseFloat(amountInput)

  const handleConfirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Amount is required.')
      focusFirstInvalidField(event.currentTarget)
      return
    }
    if (parsed > ceiling + 0.005) {
      setError(isTopUp
        ? `That is more than your free ${bucketLabel} money can cover.`
        : 'That is more than this commitment is holding.')
      focusFirstInvalidField(event.currentTarget)
      return
    }
    // Sign carries the direction: the server treats negative as a release.
    setBusy(true)
    try {
      const rejection = await onConfirm(isTopUp ? parsed : -parsed)
      if (rejection) {
        setError(rejection)
        focusFirstInvalidField(form)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      isOpen
      title={isTopUp ? 'Top Up This Commitment' : 'Release From This Commitment'}
      onClose={onClose}
      maxWidthClassName="max-w-md"
    >
      <form noValidate onSubmit={event => { void handleConfirm(event) }} className="space-y-4 py-2">
        <div className="p-4 rounded-xl bg-violet-500/10 border border-pink-500/20 flex items-center justify-between gap-3">
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
                ? <>Up to {formatSensitive(ceiling)} available from your free {bucketLabel} money.</>
                : <>Up to {formatSensitive(ceiling)} can go back to your free {bucketLabel} money.</>)
            : undefined}
          hintClassName="text-xs font-medium"
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

        <p className="text-xs text-muted-foreground font-medium">
          This reserves {fundingBucket} money without adding a ledger transaction.
        </p>
        {isTopUp && (
          <p className="text-xs text-muted-foreground font-medium">
            If this cycle stays short, the missing amount is recalculated across the cycles left before the deadline. Once the deadline arrives, the full amount still missing is due.
          </p>
        )}

        <ModalActions className="pt-2">
          <Button variant="secondary" className="rounded-xl py-2.5" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-xl py-2.5"
            disabled={busy}
          >
            {isTopUp ? 'Set Aside' : 'Release'}
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
  )
}
