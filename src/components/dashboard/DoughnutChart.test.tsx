import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppPrefsContext } from '../../contexts/AppContext'
import { DoughnutChart } from './DoughnutChart'

describe('DoughnutChart sensitive accessibility', () => {
  it('does not expose report amounts or percentages while masked', () => {
    const dashboardData = {
      monthlyCategoryBreakdown: [
        { category: 'Food', amount: 75 },
        { category: 'Transport', amount: 25 },
      ],
      last3CategoryBreakdown: [],
      last6CategoryBreakdown: [],
      yearlyCategoryBreakdown: [],
    } as any

    const { container } = render(
      <AppPrefsContext.Provider value={{
        hideSensitive: true,
        currency: 'USD',
        darkMode: false,
        formatSensitive: () => '••••',
      }}>
        <DoughnutChart dashboardData={dashboardData} selectedYear={2026} />
      </AppPrefsContext.Provider>,
    )

    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Total values hidden')
    expect(container.querySelector('svg')?.closest('[aria-hidden="true"]')).toBeTruthy()
    expect(screen.getByRole('listitem', { name: 'Food: hidden' })).toBeTruthy()
    expect(container.textContent).not.toContain('75.0%')
    expect(container.textContent).not.toContain('$100')
  })
})
