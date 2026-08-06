import { fireEvent, render, screen } from '@testing-library/react'
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
  it('stays out of selection mode until asked, then offers the bulk actions', () => {
    render(<DocumentList {...baseProps} selectedIds={new Set()} />)

    // Reading the list is the common visit, so nothing about bulk selection is on screen for it —
    // no select-all, no reserved action slot, and no per-row checkbox.
    expect(screen.queryByRole('button', { name: 'Download selected documents' })).toBeNull()
    expect(screen.queryByLabelText('Select all documents on this page')).toBeNull()
    expect(screen.queryAllByLabelText('Select tax.pdf')).toHaveLength(0)
    expect(screen.getByText('1 on this page')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    // Both layouts are mounted under jsdom, so the row checkbox appears once per layout.
    expect(screen.getByLabelText('Select all documents on this page')).not.toBeNull()
    expect(screen.queryAllByLabelText('Select tax.pdf').length).toBeGreaterThan(0)
    // Present but inert until something is actually selected.
    expect(screen.getByRole('button', { name: 'Download selected documents' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Delete selected documents' }).hasAttribute('disabled')).toBe(true)
  })

  it('forces selection mode on, and clears on leaving, so a live selection is never hidden', () => {
    const onClearSelection = vi.fn()
    render(
      <DocumentList
        {...baseProps}
        selectedIds={new Set([document.id])}
        onClearSelection={onClearSelection}
      />,
    )

    expect(screen.getByText('1 selected')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Select' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Download selected documents' }).hasAttribute('disabled')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Leave selection mode' }))
    expect(onClearSelection).toHaveBeenCalledTimes(1)
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

  it('keeps the filing facts behind a closed disclosure on the mobile card', () => {
    render(<DocumentList {...baseProps} selectedIds={new Set()} />)

    // The card is what a phone gets, and its filing block is collapsed by default: expanded, ten
    // documents ran to roughly 3,300px of scrolling. The detail is still present, not dropped.
    const filing = screen.getByText('Filing details').closest('details')
    expect(filing).not.toBeNull()
    expect(filing!.open).toBe(false)
    expect(filing!.querySelector('dl')?.textContent).toContain('Keep until')
  })

  it('shows direct document mutation state on each rendered row', () => {
    const { rerender } = render(
      <DocumentList
        {...baseProps}
        selectedIds={new Set()}
        syncingDocumentIds={new Set([document.id])}
      />,
    )

    expect(screen.getAllByText('Syncing…').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Delete tax.pdf' }).every(button => button.hasAttribute('disabled'))).toBe(true)

    rerender(
      <DocumentList
        {...baseProps}
        selectedIds={new Set()}
        deletingDocumentIds={new Set([document.id])}
      />,
    )

    expect(screen.getAllByText('Deleting…').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Delete tax.pdf' }).every(button => button.hasAttribute('disabled'))).toBe(true)
  })
})
