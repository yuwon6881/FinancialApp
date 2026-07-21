import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AiChatResponse, AiConversationState } from '../lib/api'

// Mock the API module so no network happens and we can assert on call arguments.
vi.mock('../lib/api', () => ({
  chatWithAi: vi.fn(),
}))

// Mock BottomSheet to a transparent passthrough so we test the panel's own markup/logic
// (scroll classes, send controls, state round-trip) without portals/animation.
vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, headerActions, children }: { isOpen: boolean; title: React.ReactNode; headerActions?: React.ReactNode; children: React.ReactNode }) =>
    isOpen ? <div data-testid="sheet"><header>{title}{headerActions}</header>{children}</div> : null,
}))

import * as api from '../lib/api'
import { AiAssistantPanel } from './AiAssistantPanel'

const chatWithAi = api.chatWithAi as unknown as ReturnType<typeof vi.fn>

const reply = (over: Partial<AiChatResponse> = {}): AiChatResponse => ({
  reply: 'ok',
  actions: [],
  closeChat: false,
  state: null,
  ...over,
})

const typeAndSend = (text: string) => {
  const textarea = screen.getByLabelText('Ask AI')
  fireEvent.change(textarea, { target: { value: text } })
  fireEvent.keyDown(textarea, { key: 'Enter' })
}

beforeAll(() => {
  // jsdom does not implement scrollIntoView; the panel calls it on every message change.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  chatWithAi.mockReset()
})

describe('AiAssistantPanel', () => {
  it('shows exactly three prompt suggestions from the curated pool', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    expect(screen.getAllByRole('button').filter(button => !button.getAttribute('title'))).toHaveLength(3)
  })

  it('uses hidden overflow when empty and scrollable overflow once messages exist', async () => {
    chatWithAi.mockResolvedValue(reply({ reply: 'Hello there' }))
    const { container } = render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    expect(container.querySelector('.overflow-y-hidden')).not.toBeNull()
    expect(container.querySelector('.overflow-y-auto')).toBeNull()

    typeAndSend('hi')
    await waitFor(() => expect(container.querySelector('.overflow-y-auto')).not.toBeNull())
    expect(container.querySelector('.overflow-y-hidden')).toBeNull()
  })

  it('disables the send button for empty input', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    expect((screen.getByTitle('Send') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Ask AI'), { target: { value: 'hello' } })
    expect((screen.getByTitle('Send') as HTMLButtonElement).disabled).toBe(false)
  })

  it('sends on Enter but inserts a newline on Shift+Enter', () => {
    chatWithAi.mockResolvedValue(reply())
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)
    const textarea = screen.getByLabelText('Ask AI')

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

  it('prevents duplicate sends while a request is in flight', async () => {
    let resolve!: (r: AiChatResponse) => void
    chatWithAi.mockReturnValue(new Promise<AiChatResponse>(r => { resolve = r }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    typeAndSend('hi')
    // While in flight the send button is disabled, so a second submit cannot fire.
    expect((screen.getByTitle('Send') as HTMLButtonElement).disabled).toBe(true)
    resolve(reply())
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
  })

  it('echoes the returned conversation state on the next request', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total', lastSearchText: 'coffee' }
    chatWithAi
      .mockResolvedValueOnce(reply({ reply: 'first', state }))
      .mockResolvedValueOnce(reply({ reply: 'second' }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    typeAndSend('how much did I spend')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    expect(chatWithAi.mock.calls[0][2]).toBeNull()

    typeAndSend('what about last cycle')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    expect(chatWithAi.mock.calls[1][2]).toEqual(state)
  })

  it('preserves conversation state across close and reopen', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total' }
    chatWithAi.mockResolvedValue(reply({ state }))
    const onClose = vi.fn()
    const { rerender } = render(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    typeAndSend('hi')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))

    // Close then reopen -> history is preserved, so the next send still carries the state.
    rerender(<AiAssistantPanel isOpen={false} onClose={onClose} onActions={vi.fn()} />)
    rerender(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    typeAndSend('follow up question')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    expect(chatWithAi.mock.calls[1][2]).toEqual(state)
  })

  it('clears conversation state when New chat is pressed', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total' }
    chatWithAi.mockResolvedValue(reply({ state }))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    typeAndSend('hi')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))

    // New chat resets history, so the next send starts fresh with null state.
    const newChatButton = await screen.findByRole('button', { name: /new chat/i })
    expect(newChatButton.closest('header')).not.toBeNull()
    fireEvent.click(newChatButton)
    typeAndSend('fresh question')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    expect(chatWithAi.mock.calls[1][2]).toBeNull()
  })

  it('runs a navigation action without closing the chat', async () => {
    chatWithAi.mockResolvedValue(reply({ actions: [{ type: 'openDashboard', payload: {} }], closeChat: false }))
    const onClose = vi.fn()
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    typeAndSend('open the dashboard')
    await waitFor(() => expect(onActions).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes after a navigation action explicitly requests closeChat', async () => {
    chatWithAi.mockResolvedValue(reply({ actions: [{ type: 'openDashboard', payload: {} }], closeChat: true }))
    const onClose = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={vi.fn()} />)

    typeAndSend('open dashboard and close')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('preserves the last valid state when a subsequent request fails', async () => {
    const state: AiConversationState = { lastIntent: 'ledger.spending_total', lastSearchText: 'coffee' }
    chatWithAi
      .mockResolvedValueOnce(reply({ state }))
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce(reply())
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    typeAndSend('first')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    typeAndSend('failed follow up')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(2))
    typeAndSend('retry')
    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(3))
    expect(chatWithAi.mock.calls[2][2]).toEqual(state)
  })

  it('closes before executing an add/edit modal action', async () => {
    chatWithAi.mockResolvedValue(reply({ actions: [{ type: 'openAddLedgerDraft', payload: {} }] }))
    const onClose = vi.fn()
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    typeAndSend('add a lunch transaction')
    await waitFor(() => expect(onActions).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalled()
  })

  it('ignores a stale response after the user closes the chat', async () => {
    let resolve!: (r: AiChatResponse) => void
    chatWithAi.mockReturnValue(new Promise<AiChatResponse>(r => { resolve = r }))
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={onActions} />)

    typeAndSend('delete coffee')
    fireEvent.click(screen.getByTitle('Close'))
    resolve(reply({ actions: [{ type: 'requestDeleteLedger', payload: { id: 'coffee' } }] }))

    await waitFor(() => expect(chatWithAi).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(onActions).not.toHaveBeenCalled()
  })

  it('discloses provider data sharing and sensitive-mode protection', () => {
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} sensitiveMode />)
    expect(screen.getByText(/sent to the configured AI provider/i)).toBeTruthy()
    expect(screen.getByText(/disables record changes/i)).toBeTruthy()
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

    typeAndSend('hello')

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
    const actions = [
      { type: 'openDashboard', payload: {} },
      { type: 'openDashboard', payload: { foo: 'bar' } }
    ]
    chatWithAi.mockResolvedValue(reply({ actions, closeChat: false }))
    const onActions = vi.fn()
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={onActions} />)

    typeAndSend('do two things')
    await waitFor(() => expect(onActions).toHaveBeenCalledWith(actions))
  })

  it('error bubble rendering correctly displays the error string and retry button', async () => {
    chatWithAi.mockRejectedValue(new Error('Test AI Error'))
    render(<AiAssistantPanel isOpen onClose={vi.fn()} onActions={vi.fn()} />)

    typeAndSend('failing message')

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
  })

  it('path where requiresPanelClose is true executes onClose before onActions', async () => {
    const actions = [{ type: 'openAddLedgerDraft', payload: {} }]
    chatWithAi.mockResolvedValue(reply({ actions }))

    const onClose = vi.fn()
    const onActions = vi.fn()

    render(<AiAssistantPanel isOpen onClose={onClose} onActions={onActions} />)

    typeAndSend('add something')

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
      expect(onActions).toHaveBeenCalledWith(actions)
    })

    // Check order
    const closeOrder = onClose.mock.invocationCallOrder[0]
    const actionOrder = onActions.mock.invocationCallOrder[0]
    expect(closeOrder).toBeLessThan(actionOrder)
  })
})
