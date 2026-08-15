import { useEffect, useMemo, useRef, useState } from 'react'
import type { LedgerAccount, LedgerAccountInterestFrequency, LedgerAccountKind } from '../../../../types'
import { createFinalId } from '../../../../lib/outbox'
import { maskCurrencyInput } from '../../../../lib/utils'
import {
  ACCOUNT_RECONCILIATION_EPSILON,
  calculateBucketAccountReconciliation,
  type BucketAccountReconciliation,
} from '../../../../lib/accountReconciliation'

export interface BucketSetupPrefill {
  name: string
  kind: LedgerAccountKind
  target: number
  interestEnabled?: boolean
  interestRatePercent?: number
  interestFrequency?: LedgerAccountInterestFrequency
}

export interface BucketSetupDraftAccount {
  id: string
  name: string
  kind: LedgerAccountKind
  target: string
  interestEnabled: boolean
  interestRatePercent: number
  interestFrequency: LedgerAccountInterestFrequency
}

export interface BucketSetupPendingReview {
  preview: BucketAccountReconciliation
  drafts: BucketSetupDraftAccount[]
}

export interface BucketSetupAccountSnapshot {
  id: string
  name: string
  kind: LedgerAccountKind
  isArchived: boolean
  remaining: number
}

export interface BucketSetupSessionSnapshot {
  bucketTotal: number
  accounts: ReadonlyArray<BucketSetupAccountSnapshot>
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

export function hasBucketAccountSetupChanged(
  snapshot: BucketSetupSessionSnapshot | null,
  bucketTotal: number,
  accounts: ReadonlyArray<BucketSetupAccountSnapshot>,
) {
  if (!snapshot) return false
  if (Math.abs(roundMoney(snapshot.bucketTotal) - roundMoney(bucketTotal)) >= ACCOUNT_RECONCILIATION_EPSILON) return true
  if (snapshot.accounts.length !== accounts.length) return true
  const currentById = new Map(accounts.map(account => [account.id, account]))
  return snapshot.accounts.some(account => {
    const current = currentById.get(account.id)
    return !current
      || current.name !== account.name
      || current.kind !== account.kind
      || current.isArchived !== account.isArchived
      || Math.abs(roundMoney(current.remaining) - roundMoney(account.remaining)) >= ACCOUNT_RECONCILIATION_EPSILON
  })
}

export const canReviewBucketAccountSetup = (
  preview: BucketAccountReconciliation | null,
  draftCount: number,
) => Boolean(preview && (
  preview.hasChanges
  || draftCount > 0
  || !preview.isCurrentTotalTally
  || !preview.isAdjustmentTally
))

interface UseBucketAccountSetupViewOptions {
  isOpen: boolean
  bucket: LedgerAccount['bucket'] | null
  accounts: LedgerAccount[]
  bucketTotal: number
  initialDraft?: BucketSetupPrefill | null
}

const parseAmount = (value: string) => {
  if (!value.trim()) return Number.NaN
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const createDraft = (prefill?: BucketSetupPrefill): BucketSetupDraftAccount => ({
  id: createFinalId('ledgerAccount'),
  name: prefill?.name ?? '',
  kind: prefill?.kind ?? 'Bank',
  target: prefill ? (Math.round(prefill.target * 100) / 100).toFixed(2) : '0.00',
  interestEnabled: prefill?.interestEnabled === true,
  interestRatePercent: prefill?.interestEnabled === true ? prefill.interestRatePercent ?? 0 : 0,
  interestFrequency: prefill?.interestFrequency ?? 'Monthly',
})

export function useBucketAccountSetupView({
  isOpen,
  bucket,
  accounts,
  bucketTotal,
  initialDraft = null,
}: UseBucketAccountSetupViewOptions) {
  const bucketAccounts = useMemo(
    () => bucket ? accounts.filter(account => account.bucket === bucket) : [],
    [accounts, bucket],
  )
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<BucketSetupDraftAccount[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<BucketSetupPendingReview | null>(null)
  const initializationKeyRef = useRef<string | null>(null)
  const sessionSnapshotRef = useRef<BucketSetupSessionSnapshot | null>(null)
  const initializationKey = isOpen && bucket ? JSON.stringify([bucket, initialDraft]) : null

  useEffect(() => {
    if (!initializationKey || !bucket) {
      initializationKeyRef.current = null
      sessionSnapshotRef.current = null
      return
    }
    if (initializationKeyRef.current === initializationKey) return
    initializationKeyRef.current = initializationKey
    sessionSnapshotRef.current = {
      bucketTotal: roundMoney(bucketTotal),
      accounts: bucketAccounts.map(account => ({
        id: account.id,
        name: account.name,
        kind: account.kind,
        isArchived: account.isArchived,
        remaining: roundMoney(account.remaining),
      })),
    }
    setTargetInputs(Object.fromEntries(bucketAccounts.map(account => [account.id, account.remaining.toFixed(2)])))
    setDrafts(initialDraft ? [createDraft(initialDraft)] : [])
    setErrors({})
    setPending(null)
  }, [bucket, bucketAccounts, bucketTotal, initialDraft, initializationKey])

  const updateTarget = (id: string, rawValue: string) => {
    setTargetInputs(previous => ({ ...previous, [id]: maskCurrencyInput(rawValue, previous[id] ?? '') }))
    setErrors(previous => ({ ...previous, [id]: '' }))
  }

  const updateDraft = (id: string, change: Partial<Omit<BucketSetupDraftAccount, 'id'>>) => {
    setDrafts(previous => previous.map(draft => draft.id === id ? { ...draft, ...change } : draft))
    setErrors(previous => ({ ...previous, [id]: '' }))
  }

  const updateDraftTarget = (id: string, rawValue: string) => {
    setDrafts(previous => previous.map(draft => draft.id === id
      ? { ...draft, target: maskCurrencyInput(rawValue, draft.target) }
      : draft))
    setErrors(previous => ({ ...previous, [id]: '' }))
  }

  const addDraft = () => setDrafts(previous => [...previous, createDraft()])

  const removeDraft = (id: string) => {
    setDrafts(previous => previous.filter(draft => draft.id !== id))
    setErrors(previous => ({ ...previous, [id]: '', form: '' }))
  }

  const parsedExistingTargets = useMemo(() => bucketAccounts.map(account => ({
    ...account,
    target: account.isArchived ? account.remaining : parseAmount(targetInputs[account.id] ?? ''),
  })), [bucketAccounts, targetInputs])
  const parsedDraftTargets = useMemo(() => drafts.map(draft => ({ ...draft, targetValue: parseAmount(draft.target) })), [drafts])
  const hasInvalidTarget = useMemo(
    () => parsedExistingTargets.some(account => !account.isArchived && Number.isNaN(account.target))
      || parsedDraftTargets.some(draft => Number.isNaN(draft.targetValue)),
    [parsedDraftTargets, parsedExistingTargets],
  )
  const preview = useMemo<BucketAccountReconciliation | null>(() => {
    if (!bucket || hasInvalidTarget) return null
    return calculateBucketAccountReconciliation({
      bucket,
      bucketTotal,
      existingAccounts: parsedExistingTargets.map(account => ({
        id: account.id,
        name: account.name,
        current: account.remaining,
        target: account.target,
        isArchived: account.isArchived,
      })),
      newAccounts: parsedDraftTargets.map(draft => ({
        id: draft.id,
        name: draft.name.trim(),
        target: draft.targetValue,
      })),
    })
  }, [bucket, bucketTotal, hasInvalidTarget, parsedDraftTargets, parsedExistingTargets])

  const canReview = canReviewBucketAccountSetup(preview, drafts.length)

  const prepareReview = () => {
    if (!bucket || !preview) return
    const nextErrors: Record<string, string> = {}
    const hasExternalChanges = hasBucketAccountSetupChanged(sessionSnapshotRef.current, bucketTotal, bucketAccounts)
    const names = new Set(bucketAccounts.map(account => account.name.trim().toLowerCase()))
    for (const draft of drafts) {
      const name = draft.name.trim()
      if (!name) nextErrors[draft.id] = 'Enter an account name.'
      else if (names.has(name.toLowerCase())) nextErrors[draft.id] = 'This account name is already in use.'
      else names.add(name.toLowerCase())
      if (Number.isNaN(parseAmount(draft.target))) nextErrors[`${draft.id}-target`] = 'Enter a valid balance.'
      if (draft.interestEnabled && (!Number.isFinite(draft.interestRatePercent)
          || draft.interestRatePercent <= 0 || draft.interestRatePercent > 100)) {
        nextErrors[`${draft.id}-interest`] = 'Enter an annual interest rate between 0.01% and 100%, or choose no interest.'
      }
    }
    for (const account of parsedExistingTargets) {
      if (!account.isArchived && Number.isNaN(account.target)) nextErrors[account.id] = 'Enter a valid balance.'
    }
    if (!bucketAccounts.some(account => !account.isArchived) && drafts.length === 0) {
      nextErrors.form = 'Add at least one open account to this bucket.'
    }
    if (preview && !preview.hasChanges && drafts.length === 0) {
      nextErrors.form = 'Change an account balance or add a new account before reviewing.'
    }
    if (hasExternalChanges) {
      nextErrors.form = 'The bucket or account balances changed while this form was open. Close and reopen the setup before reviewing.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setPending({
      preview,
      drafts: drafts.map(draft => ({ ...draft, name: draft.name.trim() })),
    })
  }

  return {
    bucketAccounts,
    targetInputs,
    drafts,
    errors,
    preview,
    pending,
    canReview,
    updateTarget,
    updateDraft,
    updateDraftTarget,
    addDraft,
    removeDraft,
    prepareReview,
    clearPending: () => setPending(null),
    epsilon: ACCOUNT_RECONCILIATION_EPSILON,
  }
}
