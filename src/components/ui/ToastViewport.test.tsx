import { fireEvent, render, screen } from '@testing-library/react'
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

  it('pauses auto-dismiss while a toast is being read or operated', () => {
    const onDismiss = vi.fn()
    render(
      <ToastViewport
        toasts={[{ id: 'toast-1', message: 'Review this change.', tone: 'info' }]}
        onDismiss={onDismiss}
      />,
    )
    const toast = screen.getByRole('status')

    vi.advanceTimersByTime(3000)
    fireEvent.pointerEnter(toast)
    vi.advanceTimersByTime(5000)
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.pointerLeave(toast)
    vi.advanceTimersByTime(4000)
    expect(onDismiss).toHaveBeenCalledWith('toast-1')
  })

  // A scan finishing while the phone is locked or the app is in the background raises its
  // toast against a hidden document. Starting the dismiss timer there burns the whole
  // reading window before anyone can see it, so the user comes back to an empty screen.
  it('holds a toast raised while the app is in the background until it is visible again', () => {
    const onDismiss = vi.fn()
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    render(
      <ToastViewport
        toasts={[{
          id: 'toast-1',
          title: 'Receipt Scan Completed',
          message: 'Receipt was scanned successfully.',
          tone: 'success',
          action: { label: 'Review', onAction: vi.fn() },
        }]}
        onDismiss={onDismiss}
      />,
    )

    vi.advanceTimersByTime(30_000)
    expect(onDismiss).not.toHaveBeenCalled()

    hidden.mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    vi.advanceTimersByTime(6000)
    expect(onDismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(onDismiss).toHaveBeenCalledWith('toast-1')
    hidden.mockRestore()
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
