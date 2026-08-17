import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'

describe('CommandPalette', () => {
  it('renders commands and navigates when selecting an item', () => {
    const onNavigate = vi.fn()
    const onClose = vi.fn()

    render(
      <CommandPalette
        isOpen
        onClose={onClose}
        onNavigate={onNavigate}
        darkMode={false}
        onToggleDarkMode={vi.fn()}
        hideSensitive={false}
        onToggleHideSensitive={vi.fn()}
        sensitivePreferenceStatus="resolved"
      />
    )

    expect(screen.getByRole('dialog', { name: 'Command Palette' })).toBeTruthy()
    expect(screen.getByText('Go to Today')).toBeTruthy()
    expect(screen.getByText('Go to Ledger')).toBeTruthy()

    // Click on Go to Ledger
    fireEvent.click(screen.getByText('Go to Ledger'))
    expect(onNavigate).toHaveBeenCalledWith('ledger')
    expect(onClose).toHaveBeenCalled()
  })

  it('filters commands according to the search query', () => {
    render(
      <CommandPalette
        isOpen
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        darkMode={false}
        onToggleDarkMode={vi.fn()}
        hideSensitive={false}
        onToggleHideSensitive={vi.fn()}
        sensitivePreferenceStatus="resolved"
      />
    )

    const input = screen.getByPlaceholderText('Type a command, page, or action…')
    fireEvent.change(input, { target: { value: 'recurring' } })

    expect(screen.getByText('Go to Recurring Bills & Loans')).toBeTruthy()
    expect(screen.queryByText('Go to Today')).toBeNull()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(
      <CommandPalette
        isOpen
        onClose={onClose}
        onNavigate={vi.fn()}
        darkMode={false}
        onToggleDarkMode={vi.fn()}
        hideSensitive={false}
        onToggleHideSensitive={vi.fn()}
        sensitivePreferenceStatus="resolved"
      />
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
