import React from 'react'
import type { SavingsGoal } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { maskCurrencyInput } from '../../lib/utils'

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
  // everything the goal currently holds for a release.
  const ceiling = isTopUp
    ? Math.min(available, Math.max(0, goal.targetAmount - goal.earmarkedAmount))
    : goal.earmarkedAmount
  const defaultAmount = isTopUp ? Math.min(ceiling, suggested > 0 ? suggested : ceiling) : ceiling

  const [amountInput, setAmountInput] = React.useState(() => (defaultAmount > 0 ? defaultAmount.toFixed(2) : ''))
  const [error, setError] = React.useState('')

  const parsed = Number.parseFloat(amountInput)
  const isValid = Number.isFinite(parsed) && parsed > 0 && parsed <= ceiling + 0.005

  const handleConfirm = () => {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an amount greater than 0.')
      return
    }
    if (parsed > ceiling + 0.005) {
      setError(isTopUp
        ? 'That is more than your free rewards can cover.'
        : 'That is more than this goal is holding.')
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
      <div className="space-y-4 py-2">
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-foreground truncate">{goal.name}</h4>
            <span className="text-xs text-muted-foreground font-medium">
              {formatSensitive(goal.earmarkedAmount)} of {formatSensitive(goal.targetAmount)} set aside
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-foreground">
            Amount ({currency})
          </label>
          <SmartAmountInput
            type="text"
            value={amountInput}
            onChange={event => {
              setAmountInput(previous => maskCurrencyInput(event.target.value, previous))
              setError('')
            }}
            placeholder="0.00"
            className={`w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium [appearance:textfield] ${
              error ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-ring'
            }`}
          />
          {error
            ? <p className="text-[11px] text-destructive font-medium mt-1">{error}</p>
            : (
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                {isTopUp
                  ? <>Up to {formatSensitive(ceiling)} available from your free rewards.</>
                  : <>Up to {formatSensitive(ceiling)} can go back to your free rewards.</>}
              </p>
            )}
        </div>

        <p className="text-[11px] text-muted-foreground font-medium">
          This only changes which part of your rewards is spoken for — no transaction is added to your ledger.
        </p>

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1 justify-center py-2.5" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1 justify-center py-2.5 font-bold"
            onClick={handleConfirm}
            disabled={!isValid && !error}
          >
            {isTopUp ? 'Set Aside' : 'Release'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
