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
    fireEvent.change(screen.getByRole('textbox', { name: /^Transport cycle spending guide/ }), {
      target: { value: '400' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Guides' }))

    expect(onUpdate).toHaveBeenCalledWith('cat-transport', 400)
    expect(screen.getByText(/Spending is never blocked/)).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: 'Save Guides' }))

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

    expect(screen.queryByRole('textbox', { name: /^Food cycle spending guide/ })).toBeNull()
    expect(screen.queryByDisplayValue('500.00')).toBeNull()
    expect(screen.getByRole('img', { name: 'Sensitive amount hidden' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save Guides' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('copies the recent per-cycle average into a spending guide', () => {
    render(
      <CategoryLimitsCard
        categories={[{ id: 'cat-food', name: 'Food', cycleLimit: 500 }]}
        currency="MYR"
        hideSensitive={false}
        last3CategoryBreakdown={[{ category: 'Food', amount: 1200 }]}
        onUpdate={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Use recent average/ }))
    expect((screen.getByRole('textbox', { name: /^Food cycle spending guide/ }) as HTMLInputElement).value).toBe('400.00')
  })
})
