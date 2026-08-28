import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InteractiveDoughnutChart } from './InteractiveDoughnutChart'

describe('InteractiveDoughnutChart', () => {
  it('shares hover, keyboard, and activation behavior between the chart and legend', () => {
    const onActivate = vi.fn()
    const { container } = render(
      <InteractiveDoughnutChart
        ariaLabel="Allocation"
        slices={[
          { key: 'stocks', label: 'Stocks', value: 75, color: '#2563eb' },
          { key: 'bonds', label: 'Bonds', value: 25, color: '#10b981' },
        ]}
        centerLabel="Total"
        centerValue="$100"
        formatValue={value => `$${value}`}
        onActivate={onActivate}
      />,
    )

    expect(screen.getByText('Total')).toBeTruthy()
    const bondsLegend = screen.getByRole('button', { name: 'Bonds: $25, 25.0%' })
    fireEvent.mouseEnter(bondsLegend)
    expect(screen.getByText('25.0%')).toBeTruthy()
    fireEvent.click(bondsLegend)
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ key: 'bonds' }))

    const arcs = container.querySelectorAll('path[tabindex="0"]')
    fireEvent.keyDown(arcs[0], { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ key: 'stocks' }))
  })

  it('removes masked arcs and exact values from the accessibility tree', () => {
    const { container } = render(
      <InteractiveDoughnutChart
        ariaLabel="Stocks 75%, bonds 25%"
        slices={[
          { key: 'stocks', label: 'Stocks', value: 75, color: '#2563eb' },
          { key: 'bonds', label: 'Bonds', value: 25, color: '#10b981' },
        ]}
        centerLabel="Total"
        centerValue="$100"
        formatValue={value => `$${value}`}
        masked
      />,
    )

    expect(container.querySelector('[aria-hidden="true"] path[tabindex="0"]')).toBeNull()
    expect(container.querySelectorAll('path[tabindex="-1"]')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Stocks: hidden' })).toBeTruthy()
    expect(container.textContent).not.toContain('$100')
    expect(container.textContent).not.toContain('75.0%')
  })
})
