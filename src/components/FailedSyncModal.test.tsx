import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FailedSyncModal } from './FailedSyncModal'

describe('FailedSyncModal', () => {
  it('uses readable labels without exposing internal entity ids', () => {
    render(
      <FailedSyncModal
        isOpen
        failedOps={[{
          id: 'op-1',
          entity: 'investmentCashFlow',
          type: 'add',
          targetId: 'c25ed475-0ed2-419c-a799-5a7bfe01cfce',
          payload: { type: 'Conversion', currency: 'MYR', amount: 1000, date: '2026-06-01' },
          createdAt: Date.now(),
          retryCount: 1,
          lastError: 'Insufficient MYR cash in this account.',
        }]}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
        onDiscardAll={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Cash movement').length).toBeGreaterThan(0)
    expect(screen.queryByText('investmentCashFlow')).toBeNull()
    expect(screen.queryByText('c25ed475-0ed2-419c-a799-5a7bfe01cfce')).toBeNull()
  })
})