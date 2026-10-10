import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardData } from '../../../types'
import { AllocationPlan } from './AllocationPlan'

const savedSettings = {
  targetStabilityFund: 15000,
  essentialsAlloc: 0.5,
  growthAlloc: 0.25,
  stabilityAlloc: 0.15,
  rewardsAlloc: 0.1,
  cycleDay: 28,
  currency: 'MYR',
  stabilityOverflowRedirect: 'Split: Growth 50%, Rewards 50%',
}

const makeView = (over: Record<string, unknown> = {}) => ({
  activeSettings: savedSettings,
  targetInput: '15000',
  essentialsAllocInput: '50',
  growthAllocInput: '25',
  stabilityAllocInput: '15',
  rewardsAllocInput: '10',
  cycleDayInput: '28',
  currencyInput: 'MYR',
  stabilityOverflowRedirectInput: 'Split: Growth 50%, Rewards 50%',
  errors: {},
  allocSum: 100,
  lockedAllocations: [],
  globalAllocLock: true,
  setGlobalAllocLock: vi.fn(),
  toggleLock: vi.fn(),
  handleAllocationChange: vi.fn(),
  handleSaveSettings: vi.fn((event: Event) => event.preventDefault()),
  setTargetInput: vi.fn(),
  setErrors: vi.fn(),
  setCycleDayInput: vi.fn(),
  setCurrencyInput: vi.fn(),
  setStabilityOverflowRedirectInput: vi.fn(),
  setEssentialsAllocInput: vi.fn(),
  setGrowthAllocInput: vi.fn(),
  setStabilityAllocInput: vi.fn(),
  setRewardsAllocInput: vi.fn(),
  ...over,
}) as unknown as React.ComponentProps<typeof AllocationPlan>['view']

const dashboard = { stats: { monthlyIncome: 7200 }, categories: [] } as unknown as DashboardData

const renderPlan = (view = makeView(), props: Partial<React.ComponentProps<typeof AllocationPlan>> = {}) => render(
  <AllocationPlan view={view} hideSensitive={false} settingsSyncing={false} settingsPending={false} dashboardData={dashboard} {...props} />,
)

describe('AllocationPlan', () => {
  it('reads each bucket share as money per pay', () => {
    renderPlan()
    expect(screen.getByRole('img', { name: 'Essentials 50%, Growth 25%, Stability 15%, Rewards 10%' })).toBeTruthy()
    expect(screen.getByText((_, element) => element?.tagName === 'P' && /^RM\s?3,600\.00 a pay/.test(element.textContent ?? ''))).toBeTruthy()
  })

  it('keeps the sliders away until the split is being edited', () => {
    const view = makeView()
    const { rerender } = renderPlan(view)
    expect(screen.queryByRole('slider', { name: 'Growth allocation percentage' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit split' }))
    expect(view.setGlobalAllocLock).toHaveBeenCalledWith(false)

    rerender(<AllocationPlan view={makeView({ globalAllocLock: false })} hideSensitive={false} settingsSyncing={false} settingsPending={false} dashboardData={dashboard} />)
    expect(screen.getByRole('slider', { name: 'Growth allocation percentage' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lock the Growth allocation' })).toBeTruthy()
  })

  it('shows Save only once a rule differs from what is saved', () => {
    const { rerender } = renderPlan()
    expect(screen.queryByRole('button', { name: /Save rules/ })).toBeNull()

    const dirty = makeView({ cycleDayInput: '15' })
    rerender(<AllocationPlan view={dirty} hideSensitive={false} settingsSyncing={false} settingsPending={false} dashboardData={dashboard} />)
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Save rules/ }))
    expect(dirty.handleSaveSettings).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(dirty.setCycleDayInput).toHaveBeenCalledWith('28')
    expect(dirty.setErrors).toHaveBeenCalledWith({})
  })

  it('keeps the rules labelled and editable in place', () => {
    renderPlan()
    expect(screen.getByRole('textbox', { name: /Stability fund target/ })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Ledger cycle day' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Stability fund overflow redirect' })).toBeTruthy()
  })

  it('masks the target and per-pay figures in sensitive mode', () => {
    renderPlan(makeView(), { hideSensitive: true })
    expect(screen.queryByRole('textbox', { name: /Stability fund target/ })).toBeNull()
    expect(screen.queryByText(/3,600/)).toBeNull()
    expect((screen.getByRole('button', { name: 'Edit split' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
