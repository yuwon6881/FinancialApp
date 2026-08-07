import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaxReliefOverview } from './TaxReliefOverview'
import type { TaxYearReliefSummary } from '../../../types'

const CURRENT_YEAR = new Date().getFullYear()

const category = {
  id: 'education',
  name: 'Education',
  limit: 1000,
  isInherited: false,
}

interface RenderOptions {
  onAddCategory?: (input: { name: string; limit: number }) => Promise<unknown>
  onDeleteCategory?: (categoryId: string) => Promise<unknown>
  summary?: TaxYearReliefSummary | null
}

const summaryWithDocuments = (documentCount: number): TaxYearReliefSummary => ({
  taxYear: CURRENT_YEAR,
  confirmedAmount: 0,
  pendingReviewAmount: 0,
  documentCount,
  categories: [{
    ...category,
    confirmedAmount: 0,
    pendingReviewAmount: 0,
    documentCount,
    pendingReviewCount: 0,
  }],
})

const renderOverview = ({ onAddCategory, onDeleteCategory, summary = null }: RenderOptions = {}) => render(
  <TaxReliefOverview
    summary={summary}
    categories={[category]}
    taxYear={CURRENT_YEAR}
    currency="MYR"
    isLoading={false}
    onToggleReliefCategory={vi.fn()}
    onAddCategory={onAddCategory ?? vi.fn(async () => undefined)}
    onUpdateCategory={vi.fn(async () => undefined)}
    onDeleteCategory={onDeleteCategory ?? vi.fn(async () => undefined)}
  />,
)

const openAddForm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Manage limits' }))
  fireEvent.click(screen.getByRole('button', { name: /Add category/i }))
}

function httpError(message: string, status: number): Error {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

describe('TaxReliefOverview category validation', () => {
  it('shows duplicate names inline without calling the add mutation', async () => {
    const onAddCategory = vi.fn(async () => undefined)
    renderOverview({ onAddCategory })

    openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. Education'), { target: { value: ' education ' } })
    fireEvent.change(screen.getByLabelText(/Limit \(MYR\)/), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('A category with this name already exists.')).toBeTruthy()
    expect(onAddCategory).not.toHaveBeenCalled()
  })

  it('shows required field errors inline instead of using a toast', async () => {
    renderOverview()

    openAddForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByText('Category name is required.')).toBeTruthy()
      expect(screen.getByText('Enter a non-negative limit.')).toBeTruthy()
    })
  })

  it('rejects a limit the backend column cannot hold', async () => {
    const onAddCategory = vi.fn(async () => undefined)
    renderOverview({ onAddCategory })

    openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. Education'), { target: { value: 'Lifestyle' } })
    fireEvent.change(screen.getByLabelText(/Limit \(MYR\)/), { target: { value: '99999999999999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('That limit is larger than this tracker supports.')).toBeTruthy()
    expect(onAddCategory).not.toHaveBeenCalled()
  })

  it('routes a server duplicate conflict back onto the name field', async () => {
    const onAddCategory = vi.fn(async () => {
      throw httpError('A category with this name already exists for the selected tax year.', 409)
    })
    renderOverview({ onAddCategory })

    openAddForm()
    fireEvent.change(screen.getByPlaceholderText('e.g. Education'), { target: { value: 'Lifestyle' } })
    fireEvent.change(screen.getByLabelText(/Limit \(MYR\)/), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('A category with this name already exists for the selected tax year.')).toBeTruthy()
    expect(onAddCategory).toHaveBeenCalled()
  })
})

describe('TaxReliefOverview category deletion', () => {
  it('blocks deleting a category that still holds documents', async () => {
    const onDeleteCategory = vi.fn(async () => undefined)
    renderOverview({ onDeleteCategory, summary: summaryWithDocuments(3) })

    fireEvent.click(screen.getByRole('button', { name: 'Manage limits' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Education' }))

    expect(await screen.findByText('Move the 3 documents filed under this category to another one before deleting it.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }))
    expect(onDeleteCategory).not.toHaveBeenCalled()
  })

  it('allows deletion when no documents reference the category', async () => {
    const onDeleteCategory = vi.fn(async () => undefined)
    renderOverview({ onDeleteCategory, summary: summaryWithDocuments(0) })

    fireEvent.click(screen.getByRole('button', { name: 'Manage limits' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Education' }))
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }))

    await waitFor(() => expect(onDeleteCategory).toHaveBeenCalledWith('education'))
  })

  it('shows a server refusal next to the row instead of in a toast', async () => {
    const onDeleteCategory = vi.fn(async () => {
      throw httpError('Move the documents filed under this category to another one before deleting it.', 409)
    })
    renderOverview({ onDeleteCategory, summary: summaryWithDocuments(0) })

    fireEvent.click(screen.getByRole('button', { name: 'Manage limits' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Education' }))
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }))

    expect(await screen.findByText('Move the documents filed under this category to another one before deleting it.')).toBeTruthy()
  })
})

describe('TaxReliefOverview sync status', () => {
  it('shows the shared action wording for queued category mutations', () => {
    render(
      <TaxReliefOverview
        summary={null}
        categories={[{ ...category, isPendingSync: true, pendingSyncOperationId: 'op-sync' }]}
        taxYear={CURRENT_YEAR}
        currency="MYR"
        isLoading={false}
        onToggleReliefCategory={vi.fn()}
        onAddCategory={vi.fn(async () => undefined)}
        onUpdateCategory={vi.fn(async () => undefined)}
        onDeleteCategory={vi.fn(async () => undefined)}
        activeSyncIds={['op-sync']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Manage limits' }))
    expect(screen.getByText('Syncing…')).toBeTruthy()
  })

  it('shows unsaved draft indicator and ring highlight when category edit values differ from saved', () => {
    renderOverview()

    fireEvent.click(screen.getByRole('button', { name: 'Manage limits' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    // Initially draft matches server category, so no unsaved indicator is shown
    expect(screen.queryByTitle('Unsaved change')).toBeNull()

    // Modify the limit input
    fireEvent.change(screen.getByLabelText(/Limit \(MYR\)/), { target: { value: '2000' } })

    // Unsaved indicator dot and text appear
    expect(screen.getByTitle('Unsaved change')).toBeTruthy()
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
  })
})
