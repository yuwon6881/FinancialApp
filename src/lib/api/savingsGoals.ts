import type { SavingsGoal, SavingsGoalFundingBucket } from '../../types'
import type { WireSavingsGoal, WireSavingsGoalCompletionResult, WireSavingsGoalFundingResult } from '../apiTypes'
import { deobfuscateAmount, deobfuscateSavingsGoal, deobfuscateTransaction, obfuscateAmount } from './amounts'
import { cachedGet, invalidateCache, jsonBody, request, requestVoid } from './client'

export function fetchSavingsGoals(signal?: AbortSignal): Promise<SavingsGoal[]> {
  return cachedGet('savings-goals', async () => {
    const data = await request<WireSavingsGoal[] | null>('/savings-goals', {
      errorMessage: 'Failed to fetch savings goals',
    })
    return (data || []).map(deobfuscateSavingsGoal)
  }, { signal, staleTime: 120_000 })
}

function toMutationBody(goal: Partial<SavingsGoal>) {
  return {
    ...goal,
    targetAmount: obfuscateAmount(goal.targetAmount ?? 0),
    earmarkedAmount: obfuscateAmount(goal.earmarkedAmount ?? 0),
  }
}

export async function addSavingsGoal(goal: Partial<SavingsGoal>, clientKey?: string): Promise<SavingsGoal> {
  const data = await request<WireSavingsGoal>('/savings-goals', {
    method: 'POST',
    // clientKey is the stable outbox op id: sending it lets the server dedupe a lost-response
    // retry to the already-created row instead of inserting a duplicate goal.
    ...jsonBody({ ...toMutationBody(goal), ...(clientKey ? { clientKey } : {}) }),
    errorMessage: 'Failed to create savings goal',
  })
  invalidateCache()
  return deobfuscateSavingsGoal(data)
}

export async function updateSavingsGoal(id: number, goal: SavingsGoal): Promise<void> {
  await requestVoid(`/savings-goals/${id}`, {
    method: 'PUT',
    ...jsonBody(toMutationBody(goal)),
    errorMessage: 'Failed to update savings goal',
  })
  invalidateCache()
}

export async function deleteSavingsGoal(id: number): Promise<void> {
  await requestVoid(`/savings-goals/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to delete savings goal',
  })
  invalidateCache()
}

/** Positive tops the goal up from the free remainder; negative releases back to it. */
export async function contributeToSavingsGoal(id: number, amount: number): Promise<SavingsGoal> {
  const data = await request<WireSavingsGoal>(`/savings-goals/${id}/contribute`, {
    method: 'POST',
    ...jsonBody({ amount: obfuscateAmount(amount) }),
    errorMessage: 'Failed to move money for this savings goal',
  })
  invalidateCache()
  return deobfuscateSavingsGoal(data)
}

export interface SavingsGoalFundingResult {
  goals: SavingsGoal[]
  totalGranted: number
  freeToSpend: number
  rewardsFreeToSpend: number
  essentialsFreeToSpend: number
}

/**
 * Runs the selected bucket's per-cycle waterfall server-side. Deliberately NOT routed through the
 * outbox: the distribution depends on the authoritative bucket balance, which only the server
 * knows, so this is an online-only action rather than an op that could replay against a stale balance.
 */
export async function fundSavingsGoalsForCycle(
  fundingBucket: SavingsGoalFundingBucket = 'Rewards',
): Promise<SavingsGoalFundingResult> {
  const data = await request<WireSavingsGoalFundingResult>('/savings-goals/fund', {
    method: 'POST',
    ...jsonBody({ fundingBucket }),
    errorMessage: 'Failed to fund your goals for this cycle',
  })
  invalidateCache()
  return {
    goals: (data.goals || []).map(deobfuscateSavingsGoal),
    totalGranted: deobfuscateAmount(data.totalGranted),
    freeToSpend: deobfuscateAmount(data.freeToSpend),
    rewardsFreeToSpend: deobfuscateAmount(data.rewardsFreeToSpend ?? data.freeToSpend),
    essentialsFreeToSpend: deobfuscateAmount(data.essentialsFreeToSpend),
  }
}

export async function completeSavingsGoal(id: number, accountId?: string) {
  const data = await request<WireSavingsGoalCompletionResult>(`/savings-goals/${id}/complete`, {
    method: 'POST',
    ...jsonBody({ accountId }),
    errorMessage: 'Failed to complete savings goal',
  })
  invalidateCache()
  return {
    goal: deobfuscateSavingsGoal(data.goal),
    transaction: deobfuscateTransaction(data.transaction),
  }
}
