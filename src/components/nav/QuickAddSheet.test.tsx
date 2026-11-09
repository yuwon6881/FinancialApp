import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickAddSheet } from './QuickAddSheet'

describe('QuickAddSheet', () => {
  it('keeps transaction actions and reads enabled when other blank mutations are blocked by sensitive mode', () => {
    const onAction = vi.fn()
    render(
      <QuickAddSheet
        isOpen
        onClose={vi.fn()}
        onAction={onAction}
        transactionsDisabled={false}
        mutationsDisabled
        mutationsDisabledReason="Reveal sensitive data first to create these items."
      />,
    )

    for (const label of ['Expense', 'Income', 'Transfer', 'Ask AI', 'Search']) {
      const item = screen.getByRole('menuitem', { name: new RegExp(`^${label}`) }) as HTMLButtonElement
      expect(item.disabled).toBe(false)
    }

    for (const label of ['Scan receipt', 'New bill', 'New reward', 'Investment']) {
      const item = screen.getByRole('menuitem', { name: new RegExp(`^${label}`) }) as HTMLButtonElement
      expect(item.disabled).toBe(true)
    }

    fireEvent.click(screen.getByRole('menuitem', { name: /^Expense/ }))
    expect(onAction).toHaveBeenCalledWith('expense')
  })
})
