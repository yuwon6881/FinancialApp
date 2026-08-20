import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerEmptyState } from './LedgerEmptyState'

describe('LedgerEmptyState', () => {
  it('clears filters when no rows match', () => {
    const onResetFilters = vi.fn()
    render(<LedgerEmptyState isFiltered onResetFilters={onResetFilters} onAddTransaction={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onResetFilters).toHaveBeenCalledOnce()
  })

  it('opens transaction posting for an empty cycle', () => {
    const onAddTransaction = vi.fn()
    render(<LedgerEmptyState isFiltered={false} onResetFilters={vi.fn()} onAddTransaction={onAddTransaction} />)
    fireEvent.click(screen.getByRole('button', { name: 'Post transaction' }))
    expect(onAddTransaction).toHaveBeenCalledOnce()
  })
})
