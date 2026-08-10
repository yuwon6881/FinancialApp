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
    // Absent, not disabled: a greyed destructive button still reads as red and dangerous, so it looked
    // broken rather than waiting. Its slot holds width regardless, so nothing shifts when it arrives.
    expect(screen.queryByRole('button', { name: 'Download selected documents' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete selected documents' })).toBeNull()

    // The toolbar must stay one row. As `flex flex-wrap` it fit the actions on one line beside
    // "10 selected" and two lines beside "10 on this page", so ticking a box changed its height and
    // shoved the list up — at widths between the visual-test viewports, which is how it got through.
    const toolbar = screen.getByTestId('document-selection-toolbar')
    expect(toolbar.className).toContain('grid-cols-[minmax(0,1fr)_auto]')
    expect(toolbar.className).not.toContain('flex-wrap')

    // Done is the trailing child so it stays pinned to the right edge as the bulk actions come and go.
    // A reserved fixed-width slot achieved that too, but by holding visibly empty space.
    const actions = screen.getByTestId('document-selection-actions')
    expect(actions.lastElementChild?.textContent).toBe('Done')
    expect(actions.className).not.toContain('w-20')
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
    // Still trailing once the bulk actions are beside it, so it has not moved under the thumb.
    expect(screen.getByTestId('document-selection-actions').lastElementChild?.textContent).toBe('Done')

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

  it('lets the amount editor be left without writing, and refuses an empty or negative figure', () => {
    const updateDocument = vi.fn().mockResolvedValue(undefined)
    render(
      <DocumentList
        {...baseProps}
        updateDocument={updateDocument}
        documents={[{ ...document, amount: 125.5, amountStatus: 'Confirmed' }]}
        selectedIds={new Set()}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: /Add amount|125\.50/ })[0])
    const input = screen.getAllByLabelText('Amount for tax.pdf')[0] as HTMLInputElement

    // Emptying the field used to save `null` as Confirmed — "there is definitively no amount" — from
    // what is almost always a cleared field on the way to typing a new one.
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirm amount for tax.pdf' })[0])
    expect(screen.getByRole('alert').textContent).toContain('Enter an amount')
    expect(updateDocument).not.toHaveBeenCalled()

    // A negative figure used to make the tick a silent no-op, so it just looked broken.
    fireEvent.change(input, { target: { value: '-4' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirm amount for tax.pdf' })[0])
    expect(screen.getByRole('alert').textContent).toContain('zero or more')
    expect(updateDocument).not.toHaveBeenCalled()

    // Leaving must cost nothing: the only exit used to be the tick, which writes straight to the
    // server rather than through the outbox, so a mis-tap was a real edit with no undo.
    fireEvent.click(screen.getAllByRole('button', { name: 'Stop editing the amount for tax.pdf' })[0])
    expect(screen.queryAllByLabelText('Amount for tax.pdf')).toHaveLength(0)
    expect(updateDocument).not.toHaveBeenCalled()
  })

  it('shows the server’s reason when it refuses an amount, leaving the editor open', async () => {
    // The server refuses this write for five distinct reasons and names each one. Without a catch the
    // rejection was an unhandled promise: the editor stayed open with nothing said, so the tick read
    // as broken — exactly what the validation above was added to stop it doing.
    const updateDocument = vi.fn().mockRejectedValue(
      new Error('The category is not configured for this document\'s tax year.'),
    )
    render(
      <DocumentList
        {...baseProps}
        updateDocument={updateDocument}
        documents={[{ ...document, amount: 125.5, amountStatus: 'Confirmed' }]}
        selectedIds={new Set()}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: /Add amount|125\.50/ })[0])
    fireEvent.change(screen.getAllByLabelText('Amount for tax.pdf')[0], { target: { value: '90' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirm amount for tax.pdf' })[0])

    expect((await screen.findByRole('alert')).textContent).toContain('not configured')
    // Still open, with the typed value intact, so the edit can be corrected rather than retyped.
    expect(screen.getAllByLabelText('Amount for tax.pdf')).toHaveLength(1)
  })

  it('does not open an editor for every AI-suggested amount on the page', () => {
    render(
      <DocumentList
        {...baseProps}
        documents={[
          { ...document, id: 1, amount: 340, amountStatus: 'NeedsReview' },
          { ...document, id: 2, originalFileName: 'two.pdf', amount: 56, amountStatus: 'NeedsReview' },
        ]}
        selectedIds={new Set()}
      />,
    )

    // Seeding the editor from NeedsReview put one live, uncancellable input on screen per suggested
    // row, so a batch scan landed on a page of them.
    expect(screen.queryAllByLabelText('Amount for tax.pdf')).toHaveLength(0)
    expect(screen.queryAllByLabelText('Amount for two.pdf')).toHaveLength(0)
    expect(screen.getAllByRole('button', { name: 'Review the suggested amount for tax.pdf' }).length).toBeGreaterThan(0)
  })

  it('labels the linked-transaction control rather than leaving a bare glyph', () => {
    const onNavigateToTransaction = vi.fn().mockResolvedValue(undefined)
    render(
      <DocumentList
        {...baseProps}
        documents={[{ ...document, transactionId: 'tx-1' }]}
        selectedIds={new Set()}
        onNavigateToTransaction={onNavigateToTransaction}
      />,
    )

    // `hidden sm:inline` on the label did nothing for the desktop table, which only renders from lg
    // up — it stripped the word only from the phone card, leaving a 12px glyph among status badges
    // with nothing to say it was a button or where it led.
    const linked = screen.getAllByRole('button', { name: 'Open linked transaction for tax.pdf' })
    expect(linked.length).toBeGreaterThan(0)
    expect(linked.every(button => button.textContent?.includes('Ledger'))).toBe(true)

    fireEvent.click(linked[0])
    expect(onNavigateToTransaction).toHaveBeenCalledWith('tx-1')
  })

  it('does not expose the removed legacy document category label', () => {
    render(<DocumentList {...baseProps} selectedIds={new Set()} />)

    expect(screen.queryByText(/legacy/i)).toBeNull()
    expect(screen.getAllByText('Choose tax relief category').length).toBeGreaterThan(0)
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
