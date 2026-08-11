import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppPrefsContext } from '../../contexts/AppContext'
import { TrendLineChart } from './TrendLineChart'

describe('TrendLineChart sensitive accessibility', () => {
  it('removes exact trend values and the chart from the accessibility tree while masked', () => {
    const dashboardData = {
      setting: { selectedYear: 2026 },
      trendPoints: [
        { month: 'Jan', cycleKey: '2026-01', balance: 1_000 },
        { month: 'Feb', cycleKey: '2026-02', balance: 1_250 },
      ],
      last3TrendPoints: [],
      last6TrendPoints: [],
    } as any

    const { container } = render(
      <AppPrefsContext.Provider value={{
        hideSensitive: true,
        currency: 'USD',
        darkMode: false,
        formatSensitive: () => '••••',
      }}>
        <TrendLineChart dashboardData={dashboardData} growthBalance={1_250} />
      </AppPrefsContext.Provider>,
    )

    expect(screen.getByText('Growth balance trend values are hidden.')).toBeTruthy()
    expect(container.querySelector('svg')?.closest('[aria-hidden="true"]')).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
    expect(container.textContent).not.toContain('$1,000')
    expect(container.textContent).not.toContain('$1,250')
  })
})
