import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultDocument } from '../../../types'
import { DocumentList } from './DocumentList'
import { AppPrefsContext } from '../../../contexts/AppContext'
import { SENSITIVE_AMOUNT_MASK } from '../../../lib/utils'

const document: VaultDocument = {
  id: 1,
  originalFileName: 'tax.pdf',
  contentType: 'application/pdf',
  sizeBytes: 12,
  taxYear: 2026,
  transactionId: null,
  uploadedAt: '2026-07-29T00:00:00Z',
  retentionUntil: '2033-12-31',
  reliefCategory: null,
  amount: null,
  amountCurrency: 'MYR',
  amountStatus: 'Unavailable',
  amountConfidence: null,
  amountExtractionMessage: null,
}

const baseProps = {
  documents: [document],
  isLoading: false,
  setDocToDelete: vi.fn(),
  toggleSelected: vi.fn(),
  onToggleSelectAll: vi.fn(),
  allVisibleSelected: false,
  someVisibleSelected: false,
  isDownloadingSelected: false,
  onDownloadSelected: vi.fn(),
  onDeleteSelected: vi.fn(),
  currency: 'MYR',
  updateDocument: vi.fn().mockResolvedValue(undefined),
  reliefCategoriesByTaxYear: {},
  pendingReliefCategories: new Map<number, string>(),
  onReliefCategoryChange: vi.fn(),
}

describe('DocumentList selection toolbar', () => {
  it('keeps a fixed action slot when selection actions appear', () => {
    const { rerender } = render(<DocumentList {...baseProps} selectedIds={new Set()} />)
    const toolbar = screen.getByTestId('document-selection-toolbar')
    const actionSlot = screen.getByTestId('document-selection-actions')

    expect(toolbar.className).toContain('min-h-14')
    expect(actionSlot.className).toContain('w-20')
    expect(actionSlot.className).toContain('sm:w-60')
    expect(screen.queryByRole('button', { name: 'Download selected documents' })).toBeNull()

    rerender(<DocumentList {...baseProps} selectedIds={new Set([document.id])} />)

    expect(screen.getByTestId('document-selection-toolbar')).toBe(toolbar)
    expect(screen.getByTestId('document-selection-actions')).toBe(actionSlot)
    expect(screen.getByRole('button', { name: 'Download selected documents' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Delete selected documents' })).not.toBeNull()
    expect(screen.getByText('1 selected')).not.toBeNull()
  })

  it('masks amounts and disables document actions in sensitive mode', () => {
    render(
      <AppPrefsContext.Provider value={{
        hideSensitive: true,
        currency: 'MYR',
        darkMode: false,
        formatSensitive: () => SENSITIVE_AMOUNT_MASK,
      }}>
        <DocumentList
          {...baseProps}
          documents={[{ ...document, amount: 125.5, amountStatus: 'Confirmed' }]}
          selectedIds={new Set([document.id])}
        />
      </AppPrefsContext.Provider>,
    )

    expect(screen.getAllByText(SENSITIVE_AMOUNT_MASK).length).toBeGreaterThan(0)
    expect(screen.queryByText('MYR 125.50')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Preview tax.pdf' }).every(button => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Download tax.pdf' }).every(button => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Delete tax.pdf' }).every(button => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getByRole('button', { name: 'Download selected documents' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Delete selected documents' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows direct document mutation state on each rendered row', () => {
    const { rerender } = render(
      <DocumentList
        {...baseProps}
        selectedIds={new Set()}
        syncingDocumentIds={new Set([document.id])}
      />,
    )

    expect(screen.getAllByText('Syncing...').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Delete tax.pdf' }).every(button => button.hasAttribute('disabled'))).toBe(true)

    rerender(
      <DocumentList
        {...baseProps}
        selectedIds={new Set()}
        deletingDocumentIds={new Set([document.id])}
      />,
    )

    expect(screen.getAllByText('Deleting...').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Delete tax.pdf' }).every(button => button.hasAttribute('disabled'))).toBe(true)
  })
})
