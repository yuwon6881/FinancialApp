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
  isDefault?: boolean
  interestEnabled?: boolean
  interestRatePercent?: number
  interestFrequency?: LedgerAccountInterestFrequency
}

export interface BucketSetupDraftAccount {
  id: string
  name: string
  kind: LedgerAccountKind
  target: string
  isDefault: boolean
  interestEnabled: boolean
  interestRatePercent: number
  interestFrequency: LedgerAccountInterestFrequency
}

export interface BucketSetupPendingReview {
  preview: BucketAccountReconciliation
  drafts: BucketSetupDraftAccount[]
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

const createDraft = (prefill?: BucketSetupPrefill, isDefault = false): BucketSetupDraftAccount => ({
  id: createFinalId('ledgerAccount'),
  name: prefill?.name ?? '',
  kind: prefill?.kind ?? 'Bank',
  target: prefill ? (Math.round(prefill.target * 100) / 100).toFixed(2) : '0.00',
  isDefault: prefill?.isDefault === true || isDefault,
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
  const hasLiveDefault = bucketAccounts.some(account => !account.isArchived && account.isDefault)
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<BucketSetupDraftAccount[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<BucketSetupPendingReview | null>(null)
  const initializationKeyRef = useRef<string | null>(null)
  const initializationKey = isOpen && bucket ? JSON.stringify([bucket, initialDraft]) : null

  useEffect(() => {
    if (!initializationKey || !bucket) {
      initializationKeyRef.current = null
      return
    }
    // Account balances can change while the confirmation is being applied. Only
    // reset the editor when a new setup session starts, not on every optimistic row update.
    if (initializationKeyRef.current === initializationKey) return
    initializationKeyRef.current = initializationKey
    const nextTargets = Object.fromEntries(bucketAccounts.map(account => [account.id, account.remaining.toFixed(2)]))
    const shouldCreateDefault = !hasLiveDefault && !initialDraft
    let nextDrafts = initialDraft
      ? [createDraft({ ...initialDraft, isDefault: initialDraft.isDefault === true && !hasLiveDefault })]
      : shouldCreateDefault
        ? [createDraft(undefined, true)]
        : []
    if (shouldCreateDefault) {
      const unassignedBalance = Math.round((bucketTotal - bucketAccounts.reduce((sum, account) => sum + account.remaining, 0)) * 100) / 100
      nextDrafts = nextDrafts.map(draft => ({ ...draft, target: unassignedBalance.toFixed(2) }))
    }
    setTargetInputs(nextTargets)
    setDrafts(nextDrafts)
    setErrors({})
    setPending(null)
  }, [bucket, bucketAccounts, bucketTotal, hasLiveDefault, initialDraft, initializationKey])

  const updateTarget = (id: string, rawValue: string) => {
    setTargetInputs(previous => ({
      ...previous,
      [id]: maskCurrencyInput(rawValue, previous[id] ?? ''),
    }))
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

  const updateDraftDefault = (id: string, checked: boolean) => {
    setDrafts(previous => previous.map(draft => ({
      ...draft,
      isDefault: checked ? draft.id === id : draft.id === id ? false : draft.isDefault,
    })))
    setErrors(previous => ({ ...previous, form: '' }))
  }

  const addDraft = () => {
    setDrafts(previous => [
      ...previous,
      createDraft(undefined, !hasLiveDefault && !previous.some(draft => draft.isDefault)),
    ])
  }

  const removeDraft = (id: string) => {
    setDrafts(previous => {
      const next = previous.filter(draft => draft.id !== id)
      if (!hasLiveDefault && next.length > 0 && !next.some(draft => draft.isDefault)) {
        next[0] = { ...next[0], isDefault: true }
      }
      return next
    })
    setErrors(previous => ({ ...previous, [id]: '', form: '' }))
  }

  const parsedExistingTargets = useMemo(() => bucketAccounts.map(account => ({
    ...account,
    target: account.isArchived ? account.remaining : parseAmount(targetInputs[account.id] ?? ''),
  })), [bucketAccounts, targetInputs])
  const parsedDraftTargets = useMemo(() => drafts.map(draft => ({ ...draft, targetValue: parseAmount(draft.target) })), [drafts])
  const hasInvalidTarget = useMemo(() => parsedExistingTargets.some(account => !account.isArchived && Number.isNaN(account.target))
    || parsedDraftTargets.some(draft => Number.isNaN(draft.targetValue)), [parsedDraftTargets, parsedExistingTargets])

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
        isDefault: draft.isDefault,
      })),
      hasLiveDefault,
    })
  }, [bucket, bucketTotal, hasInvalidTarget, hasLiveDefault, parsedDraftTargets, parsedExistingTargets])

  // Keep Review clickable for an inconsistent starting snapshot. The review action owns the
  // actionable refresh message; disabling the only forward action leaves the user stranded with
  // unexplained totals, as happened when an optimistic salary temporarily over-counted accounts.
  const canReview = canReviewBucketAccountSetup(preview, drafts.length)

  const prepareReview = () => {
    if (!bucket) return
    const nextErrors: Record<string, string> = {}
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
    if (!hasLiveDefault && !drafts.some(draft => draft.isDefault)) {
      nextErrors.form = 'Choose one new account as the default for this bucket.'
    }
    if (!preview) nextErrors.form = nextErrors.form ?? 'Enter a valid balance for every open account.'
    if (preview && !preview.isCurrentTotalTally && hasLiveDefault) {
      nextErrors.form = 'The current account rows do not match the bucket total. Refresh the page before changing this split.'
    }
    if (preview && !preview.isAdjustmentTally) {
      nextErrors.form = 'The account split changed while this form was open. Refresh the page and try again.'
    }
    if (preview && !preview.hasChanges && drafts.length === 0) {
      nextErrors.form = 'Change an account balance or add a new account before reviewing.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !preview) return
    setPending({
      preview,
      drafts: drafts.map(draft => ({ ...draft, name: draft.name.trim() })),
    })
  }

  return {
    bucketAccounts,
    hasLiveDefault,
    targetInputs,
    drafts,
    errors,
    preview,
    pending,
    canReview,
    updateTarget,
    updateDraft,
    updateDraftTarget,
    updateDraftDefault,
    addDraft,
    removeDraft,
    prepareReview,
    clearPending: () => setPending(null),
    epsilon: ACCOUNT_RECONCILIATION_EPSILON,
  }
}
