import { ApiError, jsonBody, request, requestVoid } from './client'
import type { AiAccountMention } from '../aiAccountMentions'
import type { AppTab } from '../../types'

// A turn can run several model rounds with lookups in between. The JSON endpoint caps the
// whole round trip; the streamed endpoint uses this as an idle limit reset by every event.
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

// What one Ask AI turn hands the next. The server owns it and re-validates every field; ids are
// only hints it re-reads for this user before anything can target them.
export interface AiConversationState {
  lastMatchedTransactionIds?: string[] | null
  lastSavingsGoalId?: number | null
  lastInvestmentRange?: string | null
  lastReportCycleKey?: string | null
  lastLoanId?: string | null
  // The request a clarification left unfinished. Echoed back verbatim so the answer to that
  // question ("yes, cimb to ryt") completes it instead of starting from nothing.
  pendingLedgerRequest?: string | null
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
  const text = (key: string, max: number) => typeof candidate[key] === 'string'
    ? (candidate[key] as string).trim().slice(0, max) || null
    : null
  const state: AiConversationState = {}
  if (Array.isArray(candidate.lastMatchedTransactionIds)) {
    state.lastMatchedTransactionIds = candidate.lastMatchedTransactionIds
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .slice(0, 50)
  }
  if (typeof candidate.lastSavingsGoalId === 'number'
    && Number.isInteger(candidate.lastSavingsGoalId)
    && candidate.lastSavingsGoalId > 0) state.lastSavingsGoalId = candidate.lastSavingsGoalId
  for (const key of ['lastInvestmentRange', 'lastReportCycleKey', 'lastLoanId'] as const) {
    const value = text(key, 100)
    if (value) state[key] = value
  }
  // Not clamped to the reference length: it is a whole request, and truncating it would hand
  // back half an instruction for the next turn to carry out.
  const pending = text('pendingLedgerRequest', 2000)
  if (pending) state.pendingLedgerRequest = pending
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
  accountMentions: AiAccountMention[] = [],
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
      ...jsonBody(buildAiChatBody(
        { message, history, state, conversation, context, forceSensitiveMode, accountMentions },
        2,
      )),
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
  return normalizeAiChatResponse(data)
}

export interface AiChatTurn {
  message: string
  history: AiChatMessage[]
  state?: AiConversationState | null
  conversation?: AiConversationRequest
  context?: AiInvocationContext
  forceSensitiveMode?: boolean
  accountMentions?: AiAccountMention[]
}

// One request body for both the JSON and the streamed chat endpoints, so the two cannot drift.
export function buildAiChatBody(turn: AiChatTurn, clientContractVersion: number) {
  return {
    message: turn.message,
    history: turn.history.slice(-6),
    state: turn.state ?? null,
    conversationId: turn.conversation?.conversationId ?? null,
    conversationVersion: turn.conversation?.conversationVersion ?? null,
    clientTurnId: turn.conversation?.clientTurnId,
    context: turn.context ?? null,
    forceSensitiveMode: turn.forceSensitiveMode ?? false,
    clientContractVersion,
    // The server re-resolves every id against the account list it owns, so this is a
    // convenience for the person typing, not an authority the request carries.
    accountMentions: turn.accountMentions ?? [],
  }
}

export function normalizeAiChatResponse(data: Partial<AiChatResponse>): AiChatResponse {
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
