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
  accountId: 'acct-essentials',
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
    onReorderDraftTransactions: vi.fn(),
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

  it('keeps the draft card opaque while its swipe actions sit behind it', async () => {
    window.innerWidth = 500
    renderView()

    await waitFor(() => {
      const surface = document.querySelector('[data-swipe-content]')
      expect(surface?.className).toContain('bg-card')
      expect(surface?.className).not.toContain('bg-card/92')
    })
  })

  it('keeps long draft wording and amounts contained in the primary row', async () => {
    window.innerWidth = 500
    renderView({
      draftTransactions: [{
        ...draft,
        description: 'Monthly household essentials and school supplies',
        category: 'Household essentials and school supplies',
      }],
    })

    await waitFor(() => {
      const surface = document.querySelector('[data-swipe-content]')
      expect(surface?.firstElementChild?.className).toContain('items-start')
      expect(surface?.firstElementChild?.querySelector('span.text-orange-500')?.className).toContain('max-w-[45%]')
      expect(screen.getByText('Household essentials and school supplies').className).toContain('truncate')
    })
  })

  it('lets keyboard users move a draft with the same reorder grip used by Investment Settings', async () => {
    const onReorderDraftTransactions = vi.fn()
    const secondDraft = { ...draft, id: 'draft-2', description: 'Groceries' }
    renderView({
      draftTransactions: [draft, secondDraft],
      onReorderDraftTransactions,
    })
    await screen.findByText('No attachments')

    const firstGrip = screen.getByRole('button', { name: /Reorder Car Fuel\. Position 1 of 2/i })
    expect(firstGrip.className).toContain('touch-none')
    expect(firstGrip.className).toContain('size-11')
    fireEvent.keyDown(firstGrip, { key: 'ArrowDown' })

    expect(onReorderDraftTransactions).toHaveBeenCalledWith([secondDraft, draft])
  })

  it('labels the recording position and explains the reversed newest-first Ledger order', async () => {
    renderView({
      draftTransactions: [draft, { ...draft, id: 'draft-2', description: 'Groceries' }],
    })
    await screen.findByText('No attachments')

    expect(screen.getByRole('button', { name: /Reorder Car Fuel\. Position 1 of 2/i }).textContent).toContain('1')
    expect(screen.getByRole('button', { name: /Reorder Groceries\. Position 2 of 2/i }).textContent).toContain('2')
    expect(screen.getByText(/same-day drafts appear in reverse order/i)).toBeTruthy()
  })

  it('summarizes readiness and exposes mobile actions without requiring a swipe', async () => {
    window.innerWidth = 500
    renderView()

    expect(screen.getByRole('region', { name: 'Batch overview' })).toBeTruthy()
    expect(screen.getByText('All ready')).toBeTruthy()
    expect(screen.getByText('Ready')).toBeTruthy()
    await screen.findByText('No attachments')

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Car Fuel' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit draft' }))
    expect(await screen.findByRole('heading', { name: 'Edit Draft' })).toBeTruthy()
  })

  it('uses one Add draft action across responsive layouts', async () => {
    const onAddAnother = vi.fn()
    renderView({ onAddAnother })
    await screen.findByText('No attachments')

    const addDraft = screen.getByRole('button', { name: 'Add draft' })
    expect(addDraft.className).not.toContain('hidden')
    expect(screen.getAllByRole('button', { name: 'Add draft' })).toHaveLength(1)
    fireEvent.click(addDraft)
    expect(onAddAnother).toHaveBeenCalledTimes(1)
  })

  it('uses an onboarding empty state without hiding the Ledger exit', () => {
    const onAddAnother = vi.fn()
    renderView({ draftTransactions: [], onAddAnother })

    expect(screen.getByRole('heading', { name: 'Your draft queue is clear' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Post Transaction' }))
    expect(onAddAnother).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('button', { name: 'Back to Ledger' })).toHaveLength(2)
  })

  it('routes an incomplete Stability drawdown to review instead of syncing', async () => {
    const onSyncDraftBatch = vi.fn()
    renderView({
      draftTransactions: [{ ...draft, ledgerCategory: 'Stability', stabilityReloadIntent: 'Unanswered' }],
      onSyncDraftBatch,
    })

    expect(screen.getAllByText('Needs review').length).toBeGreaterThan(0)
    fireEvent.click(await screen.findByRole('button', { name: 'Review Car Fuel' }))

    expect(await screen.findByRole('heading', { name: 'Edit Draft' })).toBeTruthy()
    expect(onSyncDraftBatch).not.toHaveBeenCalled()
  })

  it('adds a valid reviewed batch to the Ledger', async () => {
    const onSyncDraftBatch = vi.fn().mockResolvedValue(undefined)
    renderView({ onSyncDraftBatch })

    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 draft to Ledger' }))

    await waitFor(() => expect(onSyncDraftBatch).toHaveBeenCalledTimes(1))
  })

  it('blocks the batch when attachment hydration fails', async () => {
    const onSyncDraftBatch = vi.fn()
    renderView({
      onLoadDraftDocumentChanges: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
      onSyncDraftBatch,
    })

    expect((await screen.findByRole('alert')).textContent).toContain('Draft attachments could not be checked')
    expect((screen.getByRole('button', { name: 'Add 1 draft to Ledger' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not retrigger attachment loading when draft transactions are reordered', async () => {
    const onLoadDraftDocumentChanges = vi.fn().mockResolvedValue({ pending: [], unlinkIds: [] })
    const secondDraft = { ...draft, id: 'draft-2', description: 'Groceries' }
    const { rerender } = render(
      <DraftStagingView
        draftTransactions={[draft, secondDraft]}
        categories={[{ id: 'transport', name: 'Transport', type: 'outflow' }]}
        onUpdateDraftTransaction={vi.fn()}
        onLoadDraftDocumentChanges={onLoadDraftDocumentChanges}
        onDeleteDraftTransaction={vi.fn()}
        onReorderDraftTransactions={vi.fn()}
        onSyncDraftBatch={vi.fn()}
        hideSensitive={false}
        onCancel={vi.fn()}
        editorProps={editorProps}
      />,
    )

    await screen.findByText('No attachments')
    expect(onLoadDraftDocumentChanges).toHaveBeenCalledTimes(2)

    rerender(
      <DraftStagingView
        draftTransactions={[secondDraft, draft]}
        categories={[{ id: 'transport', name: 'Transport', type: 'outflow' }]}
        onUpdateDraftTransaction={vi.fn()}
        onLoadDraftDocumentChanges={onLoadDraftDocumentChanges}
        onDeleteDraftTransaction={vi.fn()}
        onReorderDraftTransactions={vi.fn()}
        onSyncDraftBatch={vi.fn()}
        hideSensitive={false}
        onCancel={vi.fn()}
        editorProps={editorProps}
      />,
    )

    expect(screen.queryByText('Checking attachments…')).toBeNull()
    expect(screen.getByText('No attachments')).toBeTruthy()
    expect(onLoadDraftDocumentChanges).toHaveBeenCalledTimes(2)
  })
})
