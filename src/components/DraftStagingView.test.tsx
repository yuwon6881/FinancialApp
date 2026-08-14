import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DraftStagingView } from './DraftStagingView'
import type { Transaction } from '../types'

const draft: Transaction = {
  id: 'draft-1',
  description: 'Car Fuel',
  amount: -30,
  date: '2026-07-13',
  category: 'Transport',
  ledgerCategory: 'Essentials',
  stabilityReloadIntent: 'NotRequired',
  isPendingSync: true,
}

const editorProps = {
  autocompleteSuggestions: [],
  transactions: [],
  essentialsAlloc: 0.5,
  growthAlloc: 0.25,
  stabilityAlloc: 0.15,
  rewardsAlloc: 0.1,
  cycleDay: 28,
  stabilityBalance: 1000,
  stabilityTarget: 10000,
  stabilityOverflowRedirect: '',
}

function renderView(overrides: Partial<React.ComponentProps<typeof DraftStagingView>> = {}) {
  const props: React.ComponentProps<typeof DraftStagingView> = {
    draftTransactions: [draft],
    categories: [{ id: 'transport', name: 'Transport', type: 'outflow' }],
    onUpdateDraftTransaction: vi.fn(),
    onLoadDraftDocumentChanges: vi.fn().mockResolvedValue({ pending: [], unlinkIds: [] }),
    onDeleteDraftTransaction: vi.fn(),
    onSyncDraftBatch: vi.fn(),
    hideSensitive: false,
    onCancel: vi.fn(),
    editorProps,
    ...overrides,
  }
  render(<DraftStagingView {...props} />)
  return props
}

describe('DraftStagingView', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  it('opens the shared transaction sheet in draft mode', async () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Car Fuel' }))

    expect(await screen.findByRole('heading', { name: 'Edit Draft' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: /outflow/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('routes an incomplete Stability drawdown to review instead of syncing', async () => {
    const onSyncDraftBatch = vi.fn()
    renderView({
      draftTransactions: [{ ...draft, ledgerCategory: 'Stability', stabilityReloadIntent: 'Unanswered' }],
      onSyncDraftBatch,
    })

    expect(screen.getByText('Needs review')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Review Draft' }))

    expect(await screen.findByRole('heading', { name: 'Edit Draft' })).toBeTruthy()
    expect(onSyncDraftBatch).not.toHaveBeenCalled()
  })

  it('adds a valid reviewed batch to the Ledger', async () => {
    const onSyncDraftBatch = vi.fn().mockResolvedValue(undefined)
    renderView({ onSyncDraftBatch })

    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Ledger' }))

    await waitFor(() => expect(onSyncDraftBatch).toHaveBeenCalledTimes(1))
  })

  it('blocks the batch when attachment hydration fails', async () => {
    const onSyncDraftBatch = vi.fn()
    renderView({
      onLoadDraftDocumentChanges: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
      onSyncDraftBatch,
    })

    expect((await screen.findByRole('alert')).textContent).toContain('Draft attachments could not be checked')
    expect((screen.getByRole('button', { name: 'Add 1 to Ledger' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
