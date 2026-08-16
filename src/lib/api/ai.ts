import { ApiError, jsonBody, request, requestVoid } from './client'
import type { AppTab } from '../../types'

// The backend can chain several provider calls (classification, answer, then up to a
// few ledger-draft enrichment calls) with a 30s budget each, so a stuck turn could
// otherwise spin indefinitely. Cap the whole round trip client side.
export const AI_CHAT_TIMEOUT_MS = 60_000

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export const AI_ACTION_TYPES = [
  'openLedger', 'openDashboard', 'openRecurring', 'openWishlist', 'openReports', 'openInvestments',
  'openAddLedgerDraft', 'openAddRecurringDraft', 'openAddWishlistDraft', 'openEditLedgerDraft',
  'openEditRecurringDraft', 'openEditWishlistDraft', 'openAddSavingsGoalDraft', 'openEditSavingsGoalDraft',
  'requestDeleteLedger', 'requestDeleteRecurring', 'requestDeleteWishlist', 'requestConfirmRecurringBill',
  'requestDiscardRecurringBill', 'requestPurchaseWishlist', 'requestUnpurchaseWishlist', 'toggleRecurring',
  'updateRecurringReminder', 'openLedgerExport',
] as const

export type AiActionType = typeof AI_ACTION_TYPES[number]

export interface AiUiAction {
  type: AiActionType
  payload: Record<string, unknown>
  actionId?: string | null
}

export interface AiActionBatch {
  batchId: string
  actions: AiUiAction[]
  status: 'PendingReview'
}

interface AiAmountThreshold {
  comparator: string
  low: number
  high?: number | null
}

export interface AiConversationState {
  lastIntent?: string | null
  lastSearchText?: string | null
  lastCycleHint?: string | null
  lastWishlistReference?: string | null
  lastResolvedCycle?: string | null
  lastMatchedTransactionIds?: string[] | null
  lastWishlistItemId?: number | null
  lastCategory?: string | null
  lastResolvedCycleKeys?: string[] | null
  lastAmountThreshold?: AiAmountThreshold | null
  lastExcludeTransfers?: boolean
  lastExcludedCategories?: string[] | null
  lastIncludedCategories?: string[] | null
  lastLedgerCategory?: string | null
  lastTransactionType?: string | null
  lastExactDate?: string | null
  lastComparison?: boolean
  lastRecurringReference?: string | null
  lastIntents?: string[] | null
  lastTopic?: 'transactional' | 'wishlist' | 'recurring' | 'rewards' | 'investment' | 'report' | 'loan' | null
  lastQueryFacets?: string[] | null
  lastRecurringStatus?: string | null
  lastWishlistStatus?: string | null
  lastTargetAmount?: number | null
  lastRewardsTopic?: string | null
  lastSavingsGoalId?: number | null
  lastInvestmentTopic?: string | null
  lastInvestmentRange?: string | null
  lastInvestmentInstrumentId?: string | null
  lastReportCycleKey?: string | null
  lastLoanId?: string | null
  lastLedgerAccountId?: string | null
}

export type AiInvocationPreset = 'report-review' | 'investment-explain' | 'rewards-plan' | 'loan-explain'
export type AiInvestmentRange = '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | 'all'

export interface AiInvocationContext {
  surface: AppTab
  preset?: AiInvocationPreset
  cycleKey?: string
  investmentRange?: AiInvestmentRange
  savingsGoalId?: number
  loanId?: string
  hasPendingLocalChanges: boolean
}

export interface AiChatResponse {
  reply: string
  actions: AiUiAction[]
  closeChat: boolean
  state?: AiConversationState | null
  conversationId?: string | null
  conversationVersion?: number
  historyRedacted?: boolean
  actionBatch?: AiActionBatch | null
}

export interface AiConversationSnapshot {
  conversationId: string | null
  conversationVersion: number
  messages: AiChatMessage[]
  state: AiConversationState | null
  historyRedacted?: boolean
  pendingActionBatches: AiActionBatch[]
}

export interface AiConversationRequest {
  conversationId: string | null
  // Null while this client holds no conversation id: it has never been told a version, so it
  // must not assert one. Sending the default 0 made the server read it as a claim and answer
  // "changed on another device" for any turn the client never received.
  conversationVersion: number | null
  clientTurnId: string
}

function normalizeAiConversationState(value: unknown): AiConversationState | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const text = (key: string, max = 80) => typeof candidate[key] === 'string'
    ? (candidate[key] as string).trim().slice(0, max) || null
    : null
  const ids = Array.isArray(candidate.lastMatchedTransactionIds)
    ? candidate.lastMatchedTransactionIds
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .slice(0, 50)
    : null
  const itemId = typeof candidate.lastWishlistItemId === 'number'
    && Number.isInteger(candidate.lastWishlistItemId)
    && candidate.lastWishlistItemId > 0
    ? candidate.lastWishlistItemId
    : null
  const stringArray = (key: string) => Array.isArray(candidate[key])
    ? (candidate[key] as unknown[])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, 24)
    : null
  const threshold = (() => {
    const value = candidate.lastAmountThreshold
    if (!value || typeof value !== 'object') return null
    const amount = value as Record<string, unknown>
    if (typeof amount.comparator !== 'string' || typeof amount.low !== 'number') return null
    return {
      comparator: amount.comparator,
      low: amount.low,
      high: typeof amount.high === 'number' ? amount.high : null,
    } as AiAmountThreshold
  })()

  const state: AiConversationState = {}
  for (const key of [
    'lastIntent', 'lastSearchText', 'lastCycleHint', 'lastWishlistReference',
    'lastResolvedCycle', 'lastCategory', 'lastLedgerCategory', 'lastTransactionType',
    'lastExactDate', 'lastRecurringReference', 'lastRecurringStatus', 'lastWishlistStatus',
    'lastRewardsTopic', 'lastInvestmentTopic', 'lastInvestmentRange', 'lastInvestmentInstrumentId',
    'lastReportCycleKey', 'lastLoanId', 'lastLedgerAccountId',
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(candidate, key)) state[key] = text(key)
  }
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastMatchedTransactionIds')) state.lastMatchedTransactionIds = ids
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastWishlistItemId')) state.lastWishlistItemId = itemId
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastSavingsGoalId')) {
    state.lastSavingsGoalId = typeof candidate.lastSavingsGoalId === 'number'
      && Number.isInteger(candidate.lastSavingsGoalId)
      && candidate.lastSavingsGoalId > 0
      ? candidate.lastSavingsGoalId
      : null
  }
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastResolvedCycleKeys')) state.lastResolvedCycleKeys = stringArray('lastResolvedCycleKeys')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastExcludedCategories')) state.lastExcludedCategories = stringArray('lastExcludedCategories')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastIncludedCategories')) state.lastIncludedCategories = stringArray('lastIncludedCategories')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastIntents')) state.lastIntents = stringArray('lastIntents')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastQueryFacets')) state.lastQueryFacets = stringArray('lastQueryFacets')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastTopic')) {
    state.lastTopic = candidate.lastTopic === 'transactional'
      || candidate.lastTopic === 'wishlist'
      || candidate.lastTopic === 'recurring'
      || candidate.lastTopic === 'rewards'
      || candidate.lastTopic === 'investment'
      || candidate.lastTopic === 'report'
      || candidate.lastTopic === 'loan'
      ? candidate.lastTopic
      : null
  }
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastAmountThreshold')) state.lastAmountThreshold = threshold
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastExcludeTransfers')) state.lastExcludeTransfers = candidate.lastExcludeTransfers === true
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastComparison')) state.lastComparison = candidate.lastComparison === true
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastTargetAmount')) {
    state.lastTargetAmount = typeof candidate.lastTargetAmount === 'number'
      && Number.isFinite(candidate.lastTargetAmount)
      && candidate.lastTargetAmount > 0
      ? candidate.lastTargetAmount
      : null
  }
  return state
}

const AI_ACTION_TYPE_SET = new Set<string>(AI_ACTION_TYPES)

function normalizeAiAction(value: unknown): AiUiAction | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.type !== 'string' || !AI_ACTION_TYPE_SET.has(candidate.type)) return null
  if (!candidate.payload || typeof candidate.payload !== 'object' || Array.isArray(candidate.payload)) return null
  return {
    type: candidate.type as AiActionType,
    payload: candidate.payload as Record<string, unknown>,
    actionId: typeof candidate.actionId === 'string' ? candidate.actionId : null,
  }
}

function normalizeAiActionBatch(value: unknown): AiActionBatch | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.batchId !== 'string' || !Array.isArray(candidate.actions)) return null
  const actions = candidate.actions.map(normalizeAiAction).filter((action): action is AiUiAction => action !== null)
  if (actions.length === 0) return null
  return { batchId: candidate.batchId, actions, status: 'PendingReview' }
}

export async function chatWithAi(
  message: string,
  history: AiChatMessage[],
  state?: AiConversationState | null,
  signal?: AbortSignal,
  conversation?: AiConversationRequest,
  context?: AiInvocationContext,
  forceSensitiveMode = false,
): Promise<AiChatResponse> {
  // Linked controller rather than AbortSignal.any(): the Android WebView we ship
  // through Capacitor can predate it.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, AI_CHAT_TIMEOUT_MS)
  const forwardAbort = () => controller.abort()
  if (signal?.aborted) forwardAbort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })

  let data: Partial<AiChatResponse>
  try {
    data = await request<Partial<AiChatResponse>>('/ai/chat', {
      method: 'POST',
      ...jsonBody({
        message,
        history: history.slice(-6),
        state: state ?? null,
        conversationId: conversation?.conversationId ?? null,
        conversationVersion: conversation?.conversationVersion ?? null,
        clientTurnId: conversation?.clientTurnId,
        context: context ?? null,
        forceSensitiveMode,
        clientContractVersion: 2,
      }),
      signal: controller.signal,
      errorMessage: 'AI is unavailable. Please try again.',
      errorMessageField: 'reply',
    })
  } catch (error) {
    // The caller's own abort must stay an AbortError so the panel can ignore it;
    // only our timeout is rewritten into something the user can read.
    if (timedOut && !signal?.aborted) throw new ApiError('The AI took too long to respond. Please try again.', 504)
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
  return {
    reply: data.reply || '',
    actions: Array.isArray(data.actions)
      ? data.actions.map(normalizeAiAction).filter((action): action is AiUiAction => action !== null)
      : [],
    closeChat: data.closeChat === true,
    state: normalizeAiConversationState(data.state),
    conversationId: typeof data.conversationId === 'string' ? data.conversationId : null,
    conversationVersion: typeof data.conversationVersion === 'number' ? data.conversationVersion : 0,
    historyRedacted: data.historyRedacted === true,
    actionBatch: normalizeAiActionBatch(data.actionBatch),
  }
}

export async function fetchAiConversation(forceSensitiveMode = false, signal?: AbortSignal): Promise<AiConversationSnapshot> {
  const data = await request<Partial<AiConversationSnapshot>>(`/ai/conversation${forceSensitiveMode ? '?forceSensitiveMode=true' : ''}`, {
    method: 'GET',
    signal,
    errorMessage: 'The Ask AI conversation could not be loaded.',
  })
  const messages = Array.isArray(data.messages)
    ? data.messages.filter((message): message is AiChatMessage =>
      !!message
      && (message.role === 'user' || message.role === 'assistant')
      && typeof message.content === 'string')
    : []
  return {
    conversationId: typeof data.conversationId === 'string' ? data.conversationId : null,
    conversationVersion: typeof data.conversationVersion === 'number' ? data.conversationVersion : 0,
    messages,
    state: normalizeAiConversationState(data.state),
    historyRedacted: data.historyRedacted === true,
    pendingActionBatches: Array.isArray(data.pendingActionBatches)
      ? data.pendingActionBatches
        .map(normalizeAiActionBatch)
        .filter((batch): batch is AiActionBatch => batch !== null)
      : [],
  }
}

export async function resolveAiActionBatch(
  batchId: string,
  resolution: 'accepted' | 'dismissed',
  signal?: AbortSignal,
): Promise<void> {
  await requestVoid(`/ai/action-batches/${encodeURIComponent(batchId)}/resolve`, {
    method: 'POST',
    ...jsonBody({ resolution }),
    signal,
    errorMessage: 'The AI review action could not be updated.',
  })
}

export async function deleteAiConversation(
  conversationId: string | null,
  expectedVersion: number | null,
  signal?: AbortSignal,
): Promise<void> {
  const query = conversationId
    ? `?conversationId=${encodeURIComponent(conversationId)}${expectedVersion != null ? `&expectedVersion=${expectedVersion}` : ''}`
    : ''
  await requestVoid(`/ai/conversation${query}`, {
    method: 'DELETE',
    signal,
    errorMessage: 'The current conversation could not be deleted.',
  })
}
