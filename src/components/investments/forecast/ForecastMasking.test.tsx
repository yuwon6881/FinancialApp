import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ForecastControls } from './ForecastControls'
import { ForecastTargetSection } from './ForecastTargetSection'

const mask = () => '••••'

describe('forecast controls while amounts are masked', () => {
  it('keeps the real monthly contribution out of the disabled slider', () => {
    render(
      <ForecastControls
        years={10} onYearsChange={vi.fn()}
        monthlyContribution={750} onMonthlyContributionChange={vi.fn()}
        contributionMax={2000} contributionStep={50}
        todayMoney={false} onTodayMoneyChange={vi.fn()}
        inflationPercent={2.5} onInflationPercentChange={vi.fn()}
        masked money={mask}
      />,
    )

    const slider = document.querySelector('input[aria-label="Hypothetical monthly contribution"]') as HTMLInputElement
    expect(slider.value).toBe('0')
  })

  it('keeps the target amount and the chance of reaching it hidden', () => {
    render(
      <ForecastTargetSection
        target={250000} onAdd={vi.fn()} onRemove={vi.fn()} onChange={vi.fn()}
        targetMax={1000000} targetStep={1000} years={10}
        targetChance={0.64} requiredContribution={900} maxMonthlyContribution={2000}
        onUseRequiredAmount={vi.fn()} isCalculating={false}
        masked money={mask}
      />,
    )

    expect((document.querySelector('input[aria-label="Forecast target amount"]') as HTMLInputElement).value).toBe('0')
    expect(screen.queryByText('64%')).toBeNull()
  })
})
