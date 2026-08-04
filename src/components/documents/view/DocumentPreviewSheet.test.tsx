import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VaultDocument } from '../../../types'
import { DocumentPreviewSheet } from './DocumentPreviewSheet'
import { AppPrefsContext } from '../../../contexts/AppContext'
import { SENSITIVE_AMOUNT_MASK } from '../../../lib/utils'

const getDocumentContent = vi.fn()

vi.mock('../../../lib/api/documents', () => ({
  getDocumentContent: (...args: unknown[]) => getDocumentContent(...args),
  getDocumentPreviewUrl: (id: number) => `/api/documents/${id}/content`,
  downloadDocument: vi.fn(),
}))

vi.mock('./PdfDocumentPreview', () => ({
  PdfDocumentPreview: ({ onReady }: { onReady: () => void }) => (
    <button type="button" onClick={onReady}>Rendered PDF pages</button>
  ),
}))

const document: VaultDocument = {
  id: 1,
  originalFileName: 'tax.pdf',
  contentType: 'application/pdf',
  sizeBytes: 12,
  taxYear: 2026,
  uploadedAt: '2026-07-29T00:00:00Z',
  retentionUntil: '2033-12-31',
  amountCurrency: 'MYR',
  amountStatus: 'Unavailable',
}

describe('DocumentPreviewSheet', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    getDocumentContent.mockReset()
  })

  it('renders fetched PDF bytes with the app-owned viewer', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    getDocumentContent.mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      fileName: 'tax.pdf',
      contentType: 'application/pdf',
    })

    const { unmount } = render(<DocumentPreviewSheet document={document} onClose={vi.fn()} />)

    expect(await screen.findByText('Rendered PDF pages')).toBeTruthy()
    expect(getDocumentContent).toHaveBeenCalledWith(1, 'tax.pdf')
    expect(globalThis.document.querySelector('iframe')).toBeNull()
    fireEvent.click(screen.getByText('Rendered PDF pages'))
    expect(screen.queryByRole('status')).toBeNull()

    unmount()
    expect(revokeObjectUrl).not.toHaveBeenCalled()
  })

  it('renders XML as escaped text instead of executable markup', async () => {
    getDocumentContent.mockResolvedValue({
      blob: new Blob(['<invoice><script>unsafe()</script></invoice>'], { type: 'application/xml' }),
      fileName: 'invoice.xml',
      contentType: 'application/xml',
    })

    render(<DocumentPreviewSheet document={{ ...document, originalFileName: 'invoice.xml', contentType: 'application/xml' }} onClose={vi.fn()} />)

    expect(await screen.findByText('<invoice><script>unsafe()</script></invoice>')).not.toBeNull()
    expect(globalThis.document.body.querySelector('script')).toBeNull()
  })

  it('shows a download fallback for formats browsers cannot reliably preview', async () => {
    getDocumentContent.mockResolvedValue({
      blob: new Blob(['heic'], { type: 'image/heic' }),
      fileName: 'receipt.heic',
      contentType: 'image/heic',
    })

    render(<DocumentPreviewSheet document={{ ...document, originalFileName: 'receipt.heic', contentType: 'image/heic' }} onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Preview unavailable')).not.toBeNull())
    expect(screen.getByText(/Download it to open it with another app/)).not.toBeNull()
  })

  it('closes an open preview when sensitive mode is enabled', async () => {
    const onClose = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    getDocumentContent.mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      fileName: 'tax.pdf',
      contentType: 'application/pdf',
    })
    const visiblePrefs = {
      hideSensitive: false,
      currency: 'MYR',
      darkMode: false,
      formatSensitive: () => SENSITIVE_AMOUNT_MASK,
    }

    const { rerender } = render(
      <AppPrefsContext.Provider value={visiblePrefs}>
        <DocumentPreviewSheet document={document} onClose={onClose} />
      </AppPrefsContext.Provider>,
    )
    await screen.findByText('Rendered PDF pages')

    rerender(
      <AppPrefsContext.Provider value={{ ...visiblePrefs, hideSensitive: true }}>
        <DocumentPreviewSheet document={document} onClose={onClose} />
      </AppPrefsContext.Provider>,
    )

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})
