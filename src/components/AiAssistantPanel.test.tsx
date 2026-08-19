import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AiChatResponse, AiConversationState, AiUiAction } from '../lib/api/ai'
import type { AiInvocationRequest } from './useAiConversation'
import type { LedgerAccount } from '../types'

// Mock the API module so no network happens and we can assert on call arguments.
// Declared inside the factory: vi.mock is hoisted, so a module-scope class would
// still be in its temporal dead zone when the factory first runs.
vi.mock('../lib/api/ai', () => ({
  chatWithAi: vi.fn(),
  fetchAiConversation: vi.fn(),
  deleteAiConversation: vi.fn(),
  resolveAiActionBatch: vi.fn(),
}))

vi.mock('../lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
}))

// Mock BottomSheet to a transparent passthrough so we test the panel's own markup/logic
// (scroll classes, send controls, state round-trip) without portals/animation.
vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, headerActions, children }: { isOpen: boolean; title: React.ReactNode; headerActions?: React.ReactNode; children: React.ReactNode }) =>
    isOpen ? <div data-testid="sheet"><header>{title}{headerActions}</header>{children}</div> : null,
}))

import * as aiApi from '../lib/api/ai'
import { ApiError } from '../lib/api/client'
import { AiAssistantPanel } from './AiAssistantPanel'

const chatWithAi = aiApi.chatWithAi as unknown as ReturnType<typeof vi.fn>
const fetchAiConversation = aiApi.fetchAiConversation as unknown as ReturnType<typeof vi.fn>
const deleteAiConversation = aiApi.deleteAiConversation as unknown as ReturnType<typeof vi.fn>
const resolveAiActionBatch = aiApi.resolveAiActionBatch as unknown as ReturnType<typeof vi.fn>

const reply = (over: Partial<AiChatResponse> = {}): AiChatResponse => ({
  reply: 'ok',
  actions: [],
  closeChat: false,
  state: null,
  conversationId: 'conversation-1',
  conversationVersion: 1,
  ...over,
})

const typeAndSend = async (text: string) => {
  const textarea = screen.getByLabelText('Ask AI') as HTMLTextAreaElement
  await waitFor(() => expect(textarea.disabled).toBe(false))
  fireEvent.change(textarea, { target: { value: text } })
  fireEvent.keyDown(textarea, { key: 'Enter' })
}

beforeAll(() => {
  // jsdom does not implement scrollIntoView; the panel calls it on every message change.
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  fetchAiConversation.mockResolvedValue({
    conversationId: null,
    conversationVersion: 0,
    messages: [],
    state: null,
  })
  deleteAiConversation.mockResolvedValue(undefined)
  resolveAiActionBatch.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  chatWithAi.mockReset()
  fetchAiConversation.mockReset()
  deleteAiConversation.mockReset()
  resolveAiActionBatch.mockReset()
})

describe('AiAssistantPanel', () => {
  it('shows exactly three prompt suggestions from the curated pool', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    expect(screen.getAllByRole('button').filter(button => !button.getAttribute('title'))).toHaveLength(3)
  })

  it('keeps each prompt suggestion in a centered column stack with text-dependent pill widths', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    const suggestions = screen.getByRole('group', { name: 'Suggested questions' })

    expect(suggestions.className).toContain('flex-col')
    expect(suggestions.className).toContain('items-center')
    expect(suggestions.querySelectorAll('button')).toHaveLength(3)
    expect(Array.from(suggestions.querySelectorAll('button')).every(button => button.className.includes('max-w-full') && button.className.includes('text-center'))).toBe(true)
  })

  it('hydrates the active server conversation on first open', async () => {
    fetchAiConversation.mockResolvedValueOnce({
      conversationId: 'saved-conversation',
      conversationVersion: 4,
      messages: [
        { role: 'user', content: 'Saved question' },
        { role: 'assistant', content: 'Saved answer' },
      ],
      state: { lastIntent: 'ledger.spending_total' },
    })

    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    expect(await screen.findByText('Saved question')).not.toBeNull()
    expect(screen.getByText('Saved answer')).not.toBeNull()
    expect(fetchAiConversation).toHaveBeenCalledTimes(1)
  })

  it('opens generically without sending an AI request', async () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await waitFor(() => expect(fetchAiConversation).toHaveBeenCalledTimes(1))
    expect(chatWithAi).not.toHaveBeenCalled()
  })

  it('sends one contextual launch after hydration and preserves its references', async () => {
    chatWithAi.mockResolvedValue(reply())
    const onInvocationConsumed = vi.fn()
    const invocation: AiInvocationRequest = {
      nonce: 7,
      prompt: 'Explain this cycle',
      context: {
        surface: 'reports',
        preset: 'report-review',
        cycleKey: '2026-06',
        hasPendingLocalChanges: true,
      },
      clientTurnId: 'launch-turn-7',
    }

    render(
      <AiAssistantPanel
        isOpen
        onClose={vi.fn()}
        onActions={vi.fn()}
        invocation={invocation}
        onInvocationConsumed={onInvocationConsumed}
        hasPendingLocalChanges
      />,
    )

    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    expect(chatWithAi.mock.calls[0]?.[0]).toBe('Explain this cycle')
    expect(chatWithAi.mock.calls[0]?.[4]).toEqual({
      conversationId: null,
      // No id means no version claim: sending the default 0 made the server answer "changed on
      // another device" whenever it held a turn this client had never received.
      conversationVersion: null,
      clientTurnId: 'launch-turn-7',
    })
    expect(chatWithAi.mock.calls[0]?.[5]).toEqual(invocation.context)
    expect(onInvocationConsumed).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/saved server data/)).not.toBeNull()
  })

  it('uses hidden overflow when empty and scrollable overflow once messages exist', async () => {
    chatWithAi.mockResolvedValue(reply({ reply: 'Hello there' }))
    const { container } = render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    expect(container.querySelector('.overflow-y-hidden')).not.toBeNull()
    expect(container.querySelector('.overflow-y-auto')).toBeNull()

    await typeAndSend('hi')
    await waitFor(() => expect(container.querySelector('.overflow-y-auto')).not.toBeNull())
    expect(container.querySelector('.overflow-y-hidden')).toBeNull()
  })

  it('renders assistant Markdown emphasis without showing raw asterisks', async () => {
    chatWithAi.mockResolvedValue(reply({ reply: 'Coverage: **MYR 2,970.08** with **cash**.' }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('show my coverage')

    const amount = await screen.findByText('MYR 2,970.08')
    expect(amount.tagName).toBe('STRONG')
    expect(screen.queryByText('**MYR 2,970.08**')).toBeNull()
  })

  it('disables the send button for empty input', async () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    expect((screen.getByTitle('Send') as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect((screen.getByLabelText('Ask AI') as HTMLTextAreaElement).disabled).toBe(false))
    fireEvent.change(screen.getByLabelText('Ask AI'), { target: { value: 'hello' } })
    expect((screen.getByTitle('Send') as HTMLButtonElement).disabled).toBe(false)
  })

  it('sends on Enter but inserts a newline on Shift+Enter', async () => {
    chatWithAi.mockResolvedValue(reply())
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    const textarea = screen.getByLabelText('Ask AI') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.disabled).toBe(false))

    fireEvent.change(textarea, { target: { value: 'draft' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(chatWithAi).not.toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(chatWithAi).toHaveBeenCalledTimes(1)
  })

  it('grows the composer to its cap before enabling internal scrolling', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    const textarea = screen.getByLabelText('Ask AI') as HTMLTextAreaElement
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 220 })

    fireEvent.change(textarea, { target: { value: 'A long multi-line message' } })

    expect(textarea.style.height).toBe('160px')
    expect(textarea.style.overflowY).toBe('auto')
  })

  it('restores the draft composer height when the panel is reopened', () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight')
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return this.value ? 144 : 44 },
    })

    try {
      const props = { onClose: vi.fn(), onActions: vi.fn() }
      const { rerender } = render(<AiAssistantPanel {...props} isOpen />)
      fireEvent.change(screen.getByLabelText('Ask AI'), { target: { value: 'A preserved multi-line draft' } })
      expect((screen.getByLabelText('Ask AI') as HTMLTextAreaElement).style.height).toBe('144px')

      rerender(<AiAssistantPanel {...props} isOpen={false} />)
      rerender(<AiAssistantPanel {...props} isOpen />)

      expect((screen.getByLabelText('Ask AI') as HTMLTextAreaElement).style.height).toBe('144px')
    } finally {
      if (originalScrollHeight) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', originalScrollHeight)
      } else {
        delete (HTMLTextAreaElement.prototype as unknown as { scrollHeight?: number }).scrollHeight
      }
    }
  })

  it('prevents duplicate sends while a request is in flight', async () => {
    let resolve!: (r: AiChatResponse) => void
    chatWithAi.mockReturnValue(new Promise<AiChatResponse>(r => { resolve = r }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('hi')
    // In flight the primary control is Stop, not Send, and sendMessage's own isSending
    // guard drops a second Enter — so no duplicate request can be issued.
    expect(screen.queryByTitle('Send')).toBeNull()
    expect(screen.getByTitle('Stop')).not.toBeNull()
    await typeAndSend('hi again')
    expect(chatWithAi).toHaveBeenCalledTimes(1)
    resolve(reply())
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
  })

  it('echoes the returned conversation state on the next request', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total', lastSearchText: 'coffee' }
    chatWithAi
      .mockResolvedValueOnce(reply({ reply: 'first', state }))
      .mockResolvedValueOnce(reply({ reply: 'second' }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('how much did I spend')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    expect(chatWithAi.mock.calls[0][2]).toBeNull()

    await typeAndSend('what about last cycle')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    expect(chatWithAi.mock.calls[1][2]).toEqual(state)
  })

  it('preserves conversation state across close and reopen', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total' }
    fetchAiConversation
      .mockResolvedValueOnce({ conversationId: null, conversationVersion: 0, messages: [], state: null })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        conversationVersion: 1,
        messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'ok' }],
        state,
      })
    chatWithAi.mockResolvedValue(reply({ state }))
    const onClose = vi.fn()
    const { rerender } = render(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    await typeAndSend('hi')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))

    // Close then reopen -> history is preserved, so the next send still carries the state.
    rerender(<AiAssistantPanel isOpen={false} onClose={onClose} onActions={vi.fn()} />)
    rerender(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    await typeAndSend('follow up question')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    expect(chatWithAi.mock.calls[1][2]).toEqual(state)
  })

  it('clears conversation state when New chat is pressed', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total' }
    chatWithAi.mockResolvedValue(reply({ state }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('hi')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))

    // New chat resets history, so the next send starts fresh with null state.
    const newChatButton = await screen.findByRole('button', { name: /new chat/i })
    expect(newChatButton.closest('header')).not.toBeNull()
    fireEvent.click(newChatButton)
    await waitFor(() => expect(deleteAiConversation).toHaveBeenCalledTimes(1))
    await typeAndSend('fresh question')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    expect(chatWithAi.mock.calls[1][2]).toBeNull()
  })

  it('keeps the current conversation when New chat deletion fails', async () => {
    fetchAiConversation.mockResolvedValueOnce({
      conversationId: 'saved-conversation',
      conversationVersion: 2,
      messages: [
        { role: 'user', content: 'Keep this question' },
        { role: 'assistant', content: 'Keep this answer' },
      ],
      state: null,
    })
    deleteAiConversation.mockRejectedValueOnce(new TypeError('offline'))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    expect(await screen.findByText('Keep this answer')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /new chat/i }))

    expect(await screen.findByText(/current conversation was kept/i)).not.toBeNull()
    expect(screen.getByText('Keep this question')).not.toBeNull()
    expect(screen.getByText('Keep this answer')).not.toBeNull()
  })

  it('runs a navigation action without closing the chat', async () => {
    chatWithAi.mockResolvedValue(reply({ actions: [{ type: 'openDashboard', payload: {} }], closeChat: false }))
    const onClose = vi.fn()
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    await typeAndSend('open the dashboard')
    await waitFor(() => expect(onActions).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes after a navigation action explicitly requests closeChat', async () => {
    chatWithAi.mockResolvedValue(reply({ actions: [{ type: 'openDashboard', payload: {} }], closeChat: true }))
    const onClose = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    await typeAndSend('open dashboard and close')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('resumes a server-owned action batch after hydration and then acknowledges it', async () => {
    const actions = [{ type: 'openAddLedgerDraft' as const, payload: { description: 'Badminton', amount: 10 }, actionId: 'action-1' }]
    fetchAiConversation.mockResolvedValueOnce({
      conversationId: 'conversation-1',
      conversationVersion: 1,
      messages: [
        { role: 'user', content: 'Badminton 10' },
        { role: 'assistant', content: 'I prepared 1 draft for review.' },
      ],
      state: null,
      pendingActionBatches: [{ batchId: 'batch-1', actions, status: 'PendingReview' }],
    })
    const onActions = vi.fn()
    const onClose = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Resume review' }))

    await waitFor(() => expect(onActions).toHaveBeenCalledWith(actions))
    expect(resolveAiActionBatch).toHaveBeenCalledWith('batch-1', 'accepted')
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps a durable action batch pending when frontend dispatch fails', async () => {
    const actions = [{ type: 'openAddLedgerDraft' as const, payload: { description: 'Badminton', amount: 10 }, actionId: 'action-1' }]
    chatWithAi.mockResolvedValue(reply({
      actions,
      actionBatch: { batchId: 'batch-1', actions, status: 'PendingReview' },
    }))
    const onActions = vi.fn().mockRejectedValue(new Error('lazy chunk failed'))
    const onClose = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    await typeAndSend('Badminton 10')

    expect(await screen.findByRole('button', { name: 'Resume review' })).not.toBeNull()
    expect(resolveAiActionBatch).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('preserves the last valid state when a subsequent request fails', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total', lastSearchText: 'coffee' }
    chatWithAi
      .mockResolvedValueOnce(reply({ state }))
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce(reply())
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('first')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    await typeAndSend('failed follow up')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    await typeAndSend('retry')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(3))
    expect(chatWithAi.mock.calls[2][2]).toEqual(state)
  })

  it('closes before executing an add/edit modal action', async () => {
    chatWithAi.mockResolvedValue(reply({ actions: [{ type: 'openAddLedgerDraft', payload: {} }] }))
    const onClose = vi.fn()
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    await typeAndSend('add a lunch transaction')
    await waitFor(() => expect(onActions).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalled()
  })

  it('retains an action reply when the panel closes and reopens', async () => {
    chatWithAi.mockResolvedValue(reply({
      reply: 'Draft staged for review.',
      actions: [{ type: 'openAddLedgerDraft', payload: { description: 'Badminton', amount: 10 } }],
    }))
    const props = { onClose: vi.fn(), onActions: vi.fn() }
    fetchAiConversation
      .mockResolvedValueOnce({ conversationId: null, conversationVersion: 0, messages: [], state: null })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        conversationVersion: 1,
        messages: [
          { role: 'user', content: 'Badminton 10' },
          { role: 'assistant', content: 'Draft staged for review.' },
        ],
        state: null,
      })
    const { rerender } = render(<AiAssistantPanel isOpen sensitiveMode={false} {...props} />)

    await typeAndSend('Badminton 10')
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    rerender(<AiAssistantPanel isOpen={false} sensitiveMode={false} {...props} />)
    rerender(<AiAssistantPanel isOpen sensitiveMode={false} {...props} />)

    expect(await screen.findByText('Draft staged for review.')).not.toBeNull()
  })

  it('ignores a stale response after the user closes the chat', async () => {
    let resolve!: (r: AiChatResponse) => void
    chatWithAi.mockReturnValue(new Promise<AiChatResponse>(r => { resolve = r }))
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={onActions} />)

    await typeAndSend('delete coffee')
    fireEvent.click(screen.getByTitle('Close'))
    resolve(reply({ actions: [{ type: 'requestDeleteLedger', payload: { id: 'coffee' } }] }))

    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(onActions).not.toHaveBeenCalled()
  })

  it('discloses provider data sharing and sensitive-mode protection', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} sensitiveMode />)
    expect(screen.getByText(/details go to the configured AI provider/i)).toBeTruthy()
    expect(screen.getByText(/disables changes/i)).toBeTruthy()
  })

  it('closes when the server requests it without returning actions', async () => {
    chatWithAi.mockResolvedValue(reply({ reply: 'Goodbye.', closeChat: true, actions: [] }))
    const onClose = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    await typeAndSend('bye')

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('disables prompts and sending while offline', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} isOffline />)
    expect(screen.getByText(/requires an internet connection/i)).toBeTruthy()
    expect((screen.getByLabelText('Ask AI') as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByTitle('Send') as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking a suggestion chip fills the textarea', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} sensitiveMode={false} />)
    const chips = screen.getAllByRole('button').filter(button => !button.getAttribute('title'))
    expect(chips.length).toBeGreaterThan(0)

    const chipText = chips[0].textContent!
    fireEvent.click(chips[0])

    const textarea = screen.getByLabelText('Ask AI') as HTMLTextAreaElement
    expect(textarea.value).toBe(chipText)
  })

  it('closing mid-request aborts the active request', async () => {
    let resolve!: (r: AiChatResponse) => void
    chatWithAi.mockReturnValue(new Promise<AiChatResponse>(r => { resolve = r }))
    const onClose = vi.fn()
    const { rerender } = render(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    await typeAndSend('hello')

    expect(chatWithAi).toHaveBeenCalledTimes(1)
    const abortSignal = chatWithAi.mock.calls[0][3] as AbortSignal
    expect(abortSignal.aborted).toBe(false)

    rerender(<AiAssistantPanel isOpen={false} onClose={onClose} onActions={vi.fn()} />)
    expect(abortSignal.aborted).toBe(true)

    // Resolve just to clean up
    resolve(reply())
  })

  it('sensitiveMode prop change refreshes the suggested prompts', () => {
    const { rerender } = render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} sensitiveMode={true} />)
    const secureChips = screen.getAllByRole('button').filter(b => !b.getAttribute('title')).map(b => b.textContent)

    rerender(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} sensitiveMode={false} />)
    const standardChips = screen.getAllByRole('button').filter(b => !b.getAttribute('title')).map(b => b.textContent)

    // As long as the lists are not identical in all cases, we know a refresh happened.
    // They pull from different sets.
    expect(secureChips).not.toEqual(standardChips)
  })

  it('multi-action responses trigger onActions with all actions', async () => {
    const actions: AiUiAction[] = [
      { type: 'openDashboard', payload: {} },
      { type: 'openDashboard', payload: { foo: 'bar' } }
    ]
    chatWithAi.mockResolvedValue(reply({ actions, closeChat: false }))
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={onActions} />)

    await typeAndSend('do two things')
    await waitFor(() => expect(onActions).toHaveBeenCalledWith(actions))
  })

  it('error bubble rendering correctly displays the error string and retry button', async () => {
    // A 503 carries the server's own `reply` copy, so it is safe to render verbatim.
    chatWithAi.mockRejectedValue(new ApiError('Test AI Error', 503))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('failing message')

    await waitFor(() => {
      expect(screen.getByText('Test AI Error')).not.toBeNull()
    })

    const retryBtn = screen.getByText('Retry')
    expect(retryBtn).not.toBeNull()

    // Clicking retry should resubmit
    chatWithAi.mockResolvedValueOnce(reply({ reply: 'recovered' }))
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText('recovered')).not.toBeNull()
    })
    expect(chatWithAi.mock.calls[1][4].clientTurnId).toBe(chatWithAi.mock.calls[0][4].clientTurnId)
  })

  it('reloads the active conversation on a version conflict and keeps the unsent turn retryable', async () => {
    fetchAiConversation
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        conversationVersion: 1,
        messages: [],
        state: null,
      })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        conversationVersion: 2,
        messages: [
          { role: 'user', content: 'Question from another device' },
          { role: 'assistant', content: 'Answer from another device' },
        ],
        state: { lastIntent: 'ledger.spending_total' },
      })
    chatWithAi.mockRejectedValueOnce(new ApiError('changed', 409))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('My unsent follow up')

    expect(await screen.findByText('Question from another device')).not.toBeNull()
    expect(screen.getByText('My unsent follow up')).not.toBeNull()
    expect(screen.getByText(/changed on another device/i)).not.toBeNull()
    expect(screen.getByText('Retry')).not.toBeNull()
  })

  it('never renders a raw transport error in a chat bubble', async () => {
    chatWithAi.mockRejectedValue(new ApiError('401 Unauthorized', 401))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('failing message')

    await waitFor(() => {
      expect(screen.getByText(/Your session ended/)).not.toBeNull()
    })
    expect(screen.queryByText('401 Unauthorized')).toBeNull()
  })

  it('falls back to connection copy for a non-API failure', async () => {
    chatWithAi.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('failing message')

    await waitFor(() => {
      expect(screen.getByText(/check your connection/)).not.toBeNull()
    })
    expect(screen.queryByText('Failed to fetch')).toBeNull()
  })

  it('offers a Stop control while a turn is in flight and leaves it retryable', async () => {
    chatWithAi.mockImplementation(() => new Promise(() => {}))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('a slow question')

    const stop = await screen.findByLabelText('Stop generating')
    fireEvent.click(stop)

    await waitFor(() => {
      expect(screen.getByText(/Cancelled before the AI answered/)).not.toBeNull()
    })
    expect(screen.getByText('Retry')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Start a new chat' })).not.toBeNull()
    expect(screen.getByLabelText('Send message')).not.toBeNull()
  })

  it('sends the known conversation version once an id exists', async () => {
    chatWithAi.mockResolvedValue(reply({ conversationId: 'conversation-1', conversationVersion: 3 }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('first')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    await typeAndSend('second')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))

    expect(chatWithAi.mock.calls[1][4].conversationId).toBe('conversation-1')
    expect(chatWithAi.mock.calls[1][4].conversationVersion).toBe(3)
  })

  it('keeps a stopped turn recoverable after a later question and appends its replay', async () => {
    chatWithAi.mockImplementationOnce(() => new Promise(() => {}))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('Badminton 17')
    fireEvent.click(await screen.findByLabelText('Stop generating'))
    await waitFor(() => expect(screen.getByText(/Cancelled before the AI answered/)).not.toBeNull())

    chatWithAi.mockResolvedValueOnce(reply({ reply: 'second answer' }))
    await typeAndSend('And Mamak 18+2.30')
    await waitFor(() => expect(screen.getByText('second answer')).not.toBeNull())

    // Retry belongs to the last exchange and is gone, but the stopped turn may still have been
    // committed server-side, so its recovery offer must outlive the next question.
    expect(screen.queryByText('Retry')).toBeNull()
    const askAgain = screen.getByRole('button', { name: /Ask again/ })

    chatWithAi.mockResolvedValueOnce(reply({ reply: 'recovered badminton' }))
    fireEvent.click(askAgain)

    await waitFor(() => expect(screen.getByText('recovered badminton')).not.toBeNull())
    // Same clientTurnId, so the server replays the committed turn and hands back its actions.
    expect(chatWithAi.mock.calls[2][4].clientTurnId).toBe(chatWithAi.mock.calls[0][4].clientTurnId)
    // Recovering an older turn appends; it must not swallow the completed exchange after it.
    expect(screen.getByText('second answer')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Ask again/ })).toBeNull()
  })

  it('lets a stopped turn be dismissed without asking it again', async () => {
    chatWithAi.mockImplementationOnce(() => new Promise(() => {}))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    await typeAndSend('a slow question')
    fireEvent.click(await screen.findByLabelText('Stop generating'))
    await waitFor(() => expect(screen.getByRole('button', { name: /Ask again/ })).not.toBeNull())

    fireEvent.click(screen.getByLabelText('Dismiss the stopped question'))

    expect(screen.queryByRole('button', { name: /Ask again/ })).toBeNull()
    expect(chatWithAi).toHaveBeenCalledTimes(1)
  })

  it('applies a review action before closing the panel', async () => {
    const actions: AiUiAction[] = [{ type: 'openAddLedgerDraft', payload: {} }]
    chatWithAi.mockResolvedValue(reply({ actions }))

    const onClose = vi.fn()
    const onActions = vi.fn()

    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    await typeAndSend('add something')

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
      expect(onActions).toHaveBeenCalledWith(actions)
    })

    // Check order
    const closeOrder = onClose.mock.invocationCallOrder[0]
    const actionOrder = onActions.mock.invocationCallOrder[0]
    expect(actionOrder).toBeLessThan(closeOrder)
  })

  describe('@account mentions', () => {
    const accounts = [
      { id: 'acct-cimb', name: 'CIMB', bucket: 'Essentials', kind: 'Bank', isArchived: false, remaining: 0, createdAt: '', updatedAt: '' },
      { id: 'acct-ryt', name: 'RYT', bucket: 'Essentials', kind: 'Bank', isArchived: false, remaining: 0, createdAt: '', updatedAt: '' },
    ] as LedgerAccount[]

    const renderWithAccounts = () =>
      render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} accounts={accounts} />)

    const typeInto = (value: string) => {
      const textarea = screen.getByLabelText('Ask AI') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value, selectionStart: value.length } })
      return textarea
    }

    it('opens the account list on @ and closes once the caret leaves the mention', () => {
      renderWithAccounts()
      typeInto('transfer 50 from @')
      expect(screen.getByRole('listbox', { name: 'Ledger accounts' })).toBeTruthy()

      typeInto('transfer 50 from')
      expect(screen.queryByRole('listbox', { name: 'Ledger accounts' })).toBeNull()
    })

    it('filters to the typed account and inserts its exact name on Enter', () => {
      renderWithAccounts()
      const textarea = typeInto('transfer 50 from @ry')

      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['RYTEssentials'])
      // Enter belongs to the picker while it is open, so the half-typed line is not sent.
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(chatWithAi).not.toHaveBeenCalled()
      expect((screen.getByLabelText('Ask AI') as HTMLTextAreaElement).value).toBe('transfer 50 from @RYT ')
    })

    it('sends the accounts the message names, in the order it names them', async () => {
      chatWithAi.mockResolvedValue(reply())
      renderWithAccounts()

      // The trailing space finishes the mention, so Enter belongs to the message again.
      await typeAndSend('transfer 50 from @CIMB to @RYT ')

      await waitFor(() => expect(chatWithAi).toHaveBeenCalled())
      expect(chatWithAi.mock.calls[0][7]).toEqual([
        { token: 'CIMB', accountId: 'acct-cimb' },
        { token: 'RYT', accountId: 'acct-ryt' },
      ])
    })

    it('sends no mentions when the message names none', async () => {
      chatWithAi.mockResolvedValue(reply())
      renderWithAccounts()

      await typeAndSend('how much did I spend')

      await waitFor(() => expect(chatWithAi).toHaveBeenCalled())
      expect(chatWithAi.mock.calls[0][7]).toEqual([])
    })
  })
})
