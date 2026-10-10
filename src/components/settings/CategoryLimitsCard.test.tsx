import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { CategoryLimitsCard } from './CategoryLimitsCard'

describe('CategoryLimitsCard', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  it('enables an optional guide and saves the entered cycle amount', () => {
    const onUpdate = vi.fn()
    render(
      <CategoryLimitsCard
        categories={[{ id: 'cat-transport', name: 'Transport', cycleLimit: null }]}
        currency="MYR"
        hideSensitive={false}
        onUpdate={onUpdate}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Track Transport cycle spending' }))
    fireEvent.change(screen.getByRole('textbox', { name: /^Transport limit per cycle/i }), {
      target: { value: '400' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save limits' }))

    expect(onUpdate).toHaveBeenCalledWith('cat-transport', 400)
  })

  it('saves null when an existing guide is switched off', () => {
    const onUpdate = vi.fn()
    render(
      <CategoryLimitsCard
        categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 500 }]}
        currency="MYR"
        hideSensitive={false}
        onUpdate={onUpdate}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Track Food cycle spending' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save limits' }))

    expect(onUpdate).toHaveBeenCalledWith('cat-food', null)
  })

  it('does not render spending guides for inflow categories', () => {
    render(
      <CategoryLimitsCard
        categories={[
          { id: 'cat-salary', name: 'Salary', type: 'inflow', cycleLimit: 500 },
          { id: 'cat-food', name: 'Food', type: 'outflow', cycleLimit: 500 },
        ]}
        currency="MYR"
        hideSensitive={false}
        onUpdate={vi.fn()}
      />,
    )

    expect(screen.queryByRole('switch', { name: 'Track Salary cycle spending' })).toBeNull()
    expect(screen.getByRole('switch', { name: 'Track Food cycle spending' })).not.toBeNull()
    expect(screen.getByText('1 tracked')).not.toBeNull()
  })

  it('renders saved guide amounts as a static mask in sensitive mode', () => {
    const onUpdate = vi.fn()
    render(
      <CategoryLimitsCard
        categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 500 }]}
        currency="MYR"
        hideSensitive
        onUpdate={onUpdate}
      />,
    )

    expect(screen.queryByRole('textbox', { name: /^Food limit per cycle/i })).toBeNull()
    expect(screen.queryByDisplayValue('500.00')).toBeNull()
    expect(screen.getByRole('img', { name: 'Sensitive amount hidden' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save limits' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('copies the recent per-cycle average into a spending guide', () => {
    const { rerender } = render(
      <CategoryLimitsCard
        categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 500 }]}
        currency="MYR"
        hideSensitive={false}
        last3CategoryBreakdown={[{ category: 'Food', amount: 1200 }]}
        onUpdate={vi.fn()}
      />,
    )

    // A saved limit is read on its row; tapping the row opens its amount field.
    fireEvent.click(screen.getByRole('button', { name: /^Food/ }))
    fireEvent.click(screen.getByRole('button', { name: /Use recent average/ }))
    expect((screen.getByRole('textbox', { name: /^Food limit per cycle/i }) as HTMLInputElement).value).toBe('400.00')

    rerender(
      <CategoryLimitsCard
        categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 500 }]}
        currency="MYR"
        hideSensitive={false}
        last3CategoryBreakdown={[{ category: 'Food', amount: 1200 }]}
        activeSyncIds={[]}
        onUpdate={vi.fn()}
      />,
    )
    expect((screen.getByRole('textbox', { name: /^Food limit per cycle/i }) as HTMLInputElement).value).toBe('400.00')
  })

  it('reads a saved limit on its row and shows this cycle\'s use against it', () => {
    render(
      <CategoryLimitsCard
        categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 500 }]}
        currency="MYR"
        hideSensitive={false}
        cycleSpend={[{ category: 'Food', amount: 125 }]}
        onUpdate={vi.fn()}
      />,
    )

    // Collapsed: the limit and the spend are read, not edited.
    expect(screen.queryByRole('textbox', { name: /^Food limit per cycle/i })).toBeNull()
    expect(screen.getByRole('progressbar', { name: 'Food limit used this cycle' }).getAttribute('aria-valuenow')).toBe('25')
    const row = screen.getByRole('button', { name: /^Food/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('textbox', { name: /^Food limit per cycle/i })).toBeTruthy()
  })

  it('prefers the server limit status and marks an exceeded limit', () => {
    render(
      <CategoryLimitsCard
        categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 100 }]}
        currency="MYR"
        hideSensitive={false}
        limitProgress={[{ category: 'Food', limit: 100, spent: 130, remaining: -30, pendingCommitted: 0, projectedSpend: 130, percentUsed: 1.3, status: 'Exceeded' }]}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.getByText(/over$/)).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Food limit used this cycle' }).firstElementChild?.className).toContain('bg-red-500')
  })

  it('folds categories without a limit under one row until opened', () => {
    render(
      <CategoryLimitsCard
        categories={[
          { id: 'cat-food', name: 'Food', cycleLimit: 500 },
          { id: 'cat-gifts', name: 'Gifts', cycleLimit: null },
        ]}
        currency="MYR"
        hideSensitive={false}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.queryByRole('switch', { name: 'Track Gifts cycle spending' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Without a limit/ }))
    expect(screen.getByRole('switch', { name: 'Track Gifts cycle spending' })).toBeTruthy()
  })

  it('discards unsaved limit changes', () => {
    const onUpdate = vi.fn()
    render(<CategoryLimitsCard categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 500 }]} currency="MYR" hideSensitive={false} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Track Food cycle spending' }))
    expect(screen.getByText('1 limit changed')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.queryByText('1 limit changed')).toBeNull()
    expect(screen.getByRole('switch', { name: 'Track Food cycle spending' }).getAttribute('aria-checked')).toBe('true')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('keeps a newly enabled guide open across parent rerenders', () => {
    const props = { currency: 'MYR', hideSensitive: false, onUpdate: vi.fn() }
    const { rerender } = render(<CategoryLimitsCard {...props} categories={[{ id: 'cat-food', name: 'Food', cycleLimit: null }]} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Track Food cycle spending' }))
    rerender(<CategoryLimitsCard {...props} categories={[{ id: 'cat-food', name: 'Food', cycleLimit: null }]} activeSyncIds={[]} />)

    expect(screen.getByRole('switch', { name: 'Track Food cycle spending' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('textbox', { name: /^Food limit per cycle/i })).toBeTruthy()
  })
})
