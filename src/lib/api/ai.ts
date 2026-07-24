import { jsonBody, request } from './client'

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiUiAction {
  type: string
  payload: Record<string, unknown>
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
  lastTopic?: 'transactional' | 'wishlist' | 'recurring' | null
  lastQueryFacets?: string[] | null
  lastRecurringStatus?: string | null
  lastWishlistStatus?: string | null
  lastTargetAmount?: number | null
}

export interface AiChatResponse {
  reply: string
  actions: AiUiAction[]
  closeChat: boolean
  state?: AiConversationState | null
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
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(candidate, key)) state[key] = text(key)
  }
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastMatchedTransactionIds')) state.lastMatchedTransactionIds = ids
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastWishlistItemId')) state.lastWishlistItemId = itemId
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastResolvedCycleKeys')) state.lastResolvedCycleKeys = stringArray('lastResolvedCycleKeys')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastExcludedCategories')) state.lastExcludedCategories = stringArray('lastExcludedCategories')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastIncludedCategories')) state.lastIncludedCategories = stringArray('lastIncludedCategories')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastIntents')) state.lastIntents = stringArray('lastIntents')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastQueryFacets')) state.lastQueryFacets = stringArray('lastQueryFacets')
  if (Object.prototype.hasOwnProperty.call(candidate, 'lastTopic')) {
    state.lastTopic = candidate.lastTopic === 'transactional'
      || candidate.lastTopic === 'wishlist'
      || candidate.lastTopic === 'recurring'
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

export async function chatWithAi(
  message: string,
  history: AiChatMessage[],
  state?: AiConversationState | null,
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  const data = await request<Partial<AiChatResponse>>('/ai/chat', {
    method: 'POST',
    ...jsonBody({ message, history: history.slice(-6), state: state ?? null }),
    signal,
    errorMessage: 'AI is unavailable. Please try again.',
    errorMessageField: 'reply',
  })
  return {
    reply: data.reply || '',
    actions: data.actions || [],
    closeChat: data.closeChat === true,
    state: normalizeAiConversationState(data.state),
  }
}
