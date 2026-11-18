import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CategoryLimitProgress } from '../../types'
import { CategoryLimitPerformance } from './CategoryLimitPerformance'

const prefs = vi.hoisted(() => ({ hideSensitive: true }))
vi.mock('../../contexts/AppContext', () => ({ useAppPrefs: () => prefs }))

const item = {
  category: 'Food', limit: 400, spent: 300, remaining: 100, percentUsed: 0.75,
  projectedSpend: 380, pendingCommitted: 0, status: 'OnTrack',
} as unknown as CategoryLimitProgress

describe('CategoryLimitPerformance', () => {
  it('keeps the exact share out of the meter label while amounts are masked', () => {
    prefs.hideSensitive = true
    render(<CategoryLimitPerformance items={[item]} formatSensitive={() => '••••'} />)

    expect(screen.queryByLabelText(/75%/)).toBeNull()
    expect(screen.getByLabelText('Food: share of limit used')).toBeTruthy()
  })

  it('announces the share when amounts are visible', () => {
    prefs.hideSensitive = false
    render(<CategoryLimitPerformance items={[item]} formatSensitive={value => String(value)} />)

    expect(screen.getByLabelText('Food: 75% of limit used')).toBeTruthy()
  })
})
