import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToastViewport } from './ToastViewport'

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
