import { useEffect } from 'react'
import type { LedgerAccount } from '../../../types'
import type { TransactionFormAction, TransactionFormState, TransferBucket } from './transactionFormReducer'

export function useTransactionFormAccountEffects(
  state: TransactionFormState,
  accounts: LedgerAccount[],
  dispatch: React.Dispatch<TransactionFormAction>,
) {
  useEffect(() => {
    if (state.ledgerCategory === 'AccountMove' || accounts.length === 0) return
    const bucket = state.transactionType === 'transfer'
      ? state.transferSource
      : (['Essentials', 'Growth', 'Stability', 'Rewards'].includes(state.ledgerCategory) ? state.ledgerCategory : null)
    if (bucket) {
      const selected = state.accountId ? accounts.find(account => account.id === state.accountId) : undefined
      const live = accounts.filter(account => account.bucket === bucket && !account.isArchived)
      const nextId = selected?.bucket === bucket && !selected.isArchived
        ? selected.id
        : live.length === 1 ? live[0].id : ''
      if (state.accountId !== nextId) {
        dispatch({ type: 'SET_FIELD', field: 'accountId', value: nextId })
      }
    }
    if (state.transactionType === 'transfer') {
      const isSameBucket = state.transferSource === state.transferTarget
      const selectedTarget = state.counterAccountId ? accounts.find(account => account.id === state.counterAccountId) : undefined
      if (isSameBucket) {
        const otherAccounts = accounts.filter(account => account.bucket === state.transferTarget && !account.isArchived && account.id !== state.accountId)
        if (!selectedTarget || selectedTarget.bucket !== state.transferTarget || selectedTarget.id === state.accountId) {
          const nextTargetId = otherAccounts.length === 1 ? otherAccounts[0].id : null
          if (state.counterAccountId !== nextTargetId) {
            dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: nextTargetId })
          }
        }
      } else {
        const liveTarget = accounts.filter(account => account.bucket === state.transferTarget && !account.isArchived)
        const nextTargetId = selectedTarget?.bucket === state.transferTarget && !selectedTarget.isArchived
          ? selectedTarget.id
          : liveTarget.length === 1 ? liveTarget[0].id : ''
        if (state.counterAccountId !== nextTargetId) {
          dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: nextTargetId })
        }
      }
    } else if (state.counterAccountId !== null) {
      dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: null })
    }
    if (!bucket && state.transactionType !== 'transfer' && state.ledgerCategory !== 'Income' && state.accountId !== null) {
      dispatch({ type: 'SET_FIELD', field: 'accountId', value: null })
    }
  }, [accounts, state.accountId, state.counterAccountId, state.ledgerCategory, state.transactionType, state.transferSource, state.transferTarget, dispatch])

  useEffect(() => {
    if (accounts.length === 0) return
    const buckets: TransferBucket[] = ['Essentials', 'Growth', 'Stability', 'Rewards']
    for (const bucket of buckets) {
      const selected = accounts.find(account => account.id === state.splitAccountIds[bucket])
      const live = accounts.filter(account => account.bucket === bucket && !account.isArchived)
      const nextId = selected?.bucket === bucket && !selected.isArchived
        ? selected.id
        : live.length === 1 ? live[0].id : ''
      if (state.splitAccountIds[bucket] !== nextId) {
        dispatch({ type: 'SET_SPLIT_ACCOUNT', bucket, accountId: nextId })
      }
    }
  }, [accounts, state.splitAccountIds, dispatch])
}
