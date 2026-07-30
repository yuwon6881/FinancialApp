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
})
