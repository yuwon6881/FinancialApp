import type React from 'react'
import type { Dispatch, RefObject } from 'react'
import type { TransactionFormAction, TransactionFormState } from './transactionFormReducer'
import { validateTransactionForm } from './transactionFormValidation'
import { mapFormToTransaction } from './transactionFormMapping'
import { focusFirstInvalidField } from '../../ui/formValidation'
import { getErrorMessage } from '../../../lib/errors'
import { isTransactionOutsideCycle } from '../../../lib/transactionCyclePlacement'
import type { TransactionDocumentsFieldRef } from './TransactionDocumentsField'
import type { RecoveryOffer } from '../../../lib/stabilityRecovery'
import type { UseTransactionFormOptions } from './useTransactionFormOptions'

export interface UseTransactionFormSubmitOptions extends Pick<
  UseTransactionFormOptions,
  | 'essentialsAlloc'
  | 'growthAlloc'
  | 'stabilityAlloc'
  | 'rewardsAlloc'
  | 'cycleDay'
  | 'selectedMonth'
  | 'selectedYear'
  | 'stabilityBalance'
  | 'stabilityTarget'
  | 'stabilityOverflowRedirect'
  | 'stabilityTopUpContext'
  | 'onAddTransaction'
  | 'onUpdateTransaction'
  | 'onUpdateDraftTransaction'
  | 'onOutsideCycleSave'
  | 'hideSensitive'
  | 'sensitivePreferenceStatus'
  | 'accounts'
> {
  state: TransactionFormState
  dispatch: Dispatch<TransactionFormAction>
  accountsLoading: boolean
  resolveAcceptedTopUp: () => number | undefined
  savedTopUpMovedAcrossCycles: boolean
  topUpOffer: RecoveryOffer | null
  isRecoveryCycleDate: boolean
  todayDate: string
  defaultCategory: string
  documentsFieldRef: RefObject<TransactionDocumentsFieldRef | null>
  clearFormDraft: () => void
  scanner: { clearScan: () => void }
}

export function useTransactionFormSubmit(options: UseTransactionFormSubmitOptions) {
  const {
    state,
    dispatch,
    accountsLoading,
    accounts = [],
    hideSensitive,
    sensitivePreferenceStatus,
    resolveAcceptedTopUp,
    savedTopUpMovedAcrossCycles,
    topUpOffer,
    documentsFieldRef,
    isRecoveryCycleDate,
    stabilityTopUpContext,
    essentialsAlloc,
    growthAlloc,
    stabilityAlloc,
    rewardsAlloc,
    stabilityBalance,
    stabilityTarget,
    stabilityOverflowRedirect,
    onUpdateTransaction,
    onUpdateDraftTransaction,
    onAddTransaction,
    selectedMonth,
    selectedYear,
    cycleDay,
    onOutsideCycleSave,
    todayDate,
    defaultCategory,
    clearFormDraft,
    scanner,
  } = options

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (hideSensitive || sensitivePreferenceStatus === 'pending') {
      dispatch({
        type: 'SET_ERRORS',
        errors: {
          submit: sensitivePreferenceStatus === 'pending'
            ? 'Finishing security check…'
            : 'Reveal sensitive data before saving financial changes.',
        },
      })
      return
    }
    if (accountsLoading) {
      dispatch({ type: 'SET_ERRORS', errors: { submit: 'Loading accounts… Please wait a moment before saving.' } })
      return
    }
    const validationErrors = validateTransactionForm({
      description: state.description,
      amount: state.amount,
      date: state.date,
      transactionType: state.transactionType,
      ledgerCategory: state.ledgerCategory,
      transferSource: state.transferSource,
      transferTarget: state.transferTarget,
      accountId: state.accountId,
      counterAccountId: state.counterAccountId,
      splitAccountIds: state.splitAccountIds,
      accounts,
      stabilityReloadIntent: state.stabilityReloadIntent,
    })

    if (Object.keys(validationErrors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: validationErrors })
      focusFirstInvalidField(e.currentTarget)
      return
    }

    if (state.stabilityTopUpAccepted) {
      const chosenTopUp = resolveAcceptedTopUp()
      if (savedTopUpMovedAcrossCycles) {
        dispatch({
          type: 'SET_ERRORS',
          errors: {
            stabilityTopUpAmount: 'Remove this reimbursement before moving the salary to another cycle.',
          },
        })
        focusFirstInvalidField(e.currentTarget)
        return
      }
      if (!topUpOffer || !Number.isFinite(chosenTopUp) || chosenTopUp === undefined || chosenTopUp <= 0 || chosenTopUp > topUpOffer.maxTopUp) {
        dispatch({
          type: 'SET_ERRORS',
          errors: {
            stabilityTopUpAmount: 'Enter a valid reimbursement within the available maximum.',
          },
        })
        focusFirstInvalidField(e.currentTarget)
        return
      }
    }

    const documentValidationError = documentsFieldRef.current?.getValidationError()
    if (documentValidationError) {
      focusFirstInvalidField(e.currentTarget)
      return
    }

    const mapped = mapFormToTransaction(state, {
      essentialsAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.essentialsAlloc : essentialsAlloc,
      growthAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.growthAlloc : growthAlloc,
      stabilityAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.stabilityAlloc : stabilityAlloc,
      rewardsAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.rewardsAlloc : rewardsAlloc,
      stabilityBalance: isRecoveryCycleDate ? stabilityTopUpContext!.recovery.currentBalance : stabilityBalance,
      stabilityTarget: isRecoveryCycleDate ? stabilityTopUpContext!.recovery.target : stabilityTarget,
      stabilityOverflowRedirect: isRecoveryCycleDate
        ? stabilityTopUpContext!.stabilityOverflowRedirect
        : stabilityOverflowRedirect,
      recoveryTopUp: resolveAcceptedTopUp(),
    })

    const documentChanges = documentsFieldRef.current?.getChanges() ?? { pending: [], unlinkIds: [] }

    try {
      if (state.mode === 'edit' && state.editingId) {
        await onUpdateTransaction?.(state.editingId, mapped, documentChanges)
      } else if (state.mode === 'draft' && state.editingId) {
        await onUpdateDraftTransaction?.(state.editingId, mapped, documentChanges)
      } else {
        await onAddTransaction(mapped, documentChanges)
      }
      if (isTransactionOutsideCycle(mapped.date, selectedMonth, selectedYear, cycleDay)) {
        onOutsideCycleSave?.(mapped.date)
      }
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      clearFormDraft()
      scanner.clearScan()
    } catch (error) {
      dispatch({
        type: 'SET_ERRORS',
        errors: { submit: getErrorMessage(error, 'This transaction could not be saved. Please try again.') },
      })
      return
    }

    documentsFieldRef.current?.reset()
  }

  return { handleSubmit }
}
