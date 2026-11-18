import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WishlistItem } from '../../types'
import { RewardsSection } from './RewardsSection'

const item = (id: number, name: string, price: number): WishlistItem => ({
  id, name, price, priority: 'Medium', isPurchased: false, createdAt: '2026-01-01T00:00:00Z', isActive: true,
})
const items = [item(1, 'Headphones', 50), item(2, 'Camera', 900)]

const renderSection = (hideSensitive: boolean) => render(
  <RewardsSection
    items={items}
    activeItem={items[1]}
    affordableCount={1}
    claimableBalance={100}
    freeAfterGoalPace={100}
    formatSensitive={value => hideSensitive ? '••••' : String(value)}
    hideSensitive={hideSensitive}
    rewardTimeline={() => 'about 4 cycles (Dec 2026)'}
    isSyncing={() => false}
    isDeleting={() => false}
    onAdd={vi.fn()}
    onClaim={vi.fn()}
    onFocus={vi.fn()}
    onEdit={vi.fn()}
    onDelete={vi.fn()}
  />,
)

describe('RewardsSection', () => {
  it('hides the claimable count and the saving timeline while balances are masked', () => {
    renderSection(true)

    expect(screen.queryByText(/claimable/)).toBeNull()
    expect(screen.queryByText(/4 cycles/)).toBeNull()
  })

  it('shows them when balances are visible', () => {
    renderSection(false)

    expect(screen.getByText('1 claimable')).toBeTruthy()
    expect(screen.getByText(/in about 4 cycles/)).toBeTruthy()
  })
})
