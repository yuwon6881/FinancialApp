import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToastMessage } from './ToastViewport'
import { ToastViewport } from './ToastViewport'

describe('ToastViewport dismissal timers', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not restart an existing toast’s timer when another arrives', () => {
    const onDismiss = vi.fn()
    // An Undo toast: the longest-lived tone, and the one whose window matters most.
    const first: ToastMessage = {
      id: 'toast-1',
      message: 'The transaction was deleted.',
      tone: 'success',
      action: { label: 'Undo', onAction: vi.fn() },
    }
    const { rerender } = render(<ToastViewport toasts={[first]} onDismiss={onDismiss} />)

    vi.advanceTimersByTime(6000)
    // The outbox emits a batch 350ms apart, so a second toast lands mid-window routinely.
    rerender(
      <ToastViewport
        toasts={[first, { id: 'toast-2', message: 'A second change synced.', tone: 'success' }]}
        onDismiss={onDismiss}
      />,
    )
    vi.advanceTimersByTime(1000)

    expect(onDismiss).toHaveBeenCalledWith('toast-1')
  })
})

describe('ToastViewport overlay host', () => {
  it('portals notifications outside the isolated app shell above modal layers', () => {
    render(
      <div className="app-shell">
        <ToastViewport
          toasts={[{ id: 'toast-1', title: 'Saved', message: 'The record was saved.', tone: 'success' }]}
          onDismiss={vi.fn()}
        />
      </div>,
    )

    const viewport = screen.getByRole('region', { name: 'Notifications' })
    expect(viewport.parentElement).toBe(document.body)
    expect(viewport.className).toContain('z-[400]')
    expect(viewport.closest('.app-shell')).toBeNull()
    expect(screen.getByText('The record was saved.')).toBeTruthy()
  })
})
