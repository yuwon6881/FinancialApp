import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DocumentUploadSheet } from './DocumentUploadSheet'

const showToast = vi.fn()

vi.mock('../../contexts/AppContext', () => ({
  useAppUi: () => ({ showToast }),
}))

const getDocumentConstraints = vi.fn(async () => ({
  maxDocumentBytes: 20 * 1024 * 1024,
  maxBulkDocuments: 10,
  maxTotalBytesPerUser: 2 * 1024 * 1024 * 1024,
}))
const getTaxReliefCategories = vi.fn(async () => [
  { id: 'education', name: 'Education', limit: 1000, isInherited: false },
])
const uploadDocuments = vi.fn()
const uploadDocument = vi.fn()
const deleteDocument = vi.fn()
const bulkDeleteDocuments = vi.fn()

vi.mock('../../lib/api/documents', () => ({
  getDocumentConstraints: (...args: unknown[]) => getDocumentConstraints(...(args as [])),
  getTaxReliefCategories: (...args: unknown[]) => getTaxReliefCategories(...(args as [])),
  uploadDocuments: (...args: unknown[]) => uploadDocuments(...(args as [])),
  uploadDocument: (...args: unknown[]) => uploadDocument(...(args as [])),
  deleteDocument: (...args: unknown[]) => deleteDocument(...(args as [])),
  bulkDeleteDocuments: (...args: unknown[]) => bulkDeleteDocuments(...(args as [])),
}))

const renderSheet = () => render(
  <DocumentUploadSheet
    isOpen
    onClose={vi.fn()}
    onSuccess={vi.fn()}
    currency="MYR"
  />,
)

const chooseFile = async () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
  await screen.findByText('receipt.pdf')
}

const chooseCategory = async () => {
  fireEvent.click(screen.getByRole('combobox', { name: /Tax relief category/ }))
  fireEvent.click(await screen.findByRole('option', { name: /Education/ }))
}

describe('DocumentUploadSheet validation', () => {
  beforeEach(() => {
    showToast.mockClear()
    uploadDocuments.mockReset()
    deleteDocument.mockReset()
    bulkDeleteDocuments.mockReset()
  })

  it('reports a missing file on the field rather than through a toast', async () => {
    renderSheet()
    await waitFor(() => expect(getTaxReliefCategories).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /^Upload/ }))

    expect(await screen.findByText('Choose at least one document.')).toBeTruthy()
    expect(showToast).not.toHaveBeenCalled()
    expect(uploadDocuments).not.toHaveBeenCalled()
  })

  it('reports a missing relief category on the field', async () => {
    renderSheet()
    await waitFor(() => expect(getTaxReliefCategories).toHaveBeenCalled())
    await chooseFile()

    fireEvent.click(screen.getByRole('button', { name: /^Upload/ }))

    expect(await screen.findByText('Choose a tax relief category before uploading.')).toBeTruthy()
    expect(uploadDocuments).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('keeps a rejected upload reason inside the sheet when the server names a field', async () => {
    const error = new Error('Tax year must be between 2019 and 2026.') as Error & { status?: number }
    error.status = 400
    uploadDocuments.mockRejectedValue(error)

    renderSheet()
    await waitFor(() => expect(getTaxReliefCategories).toHaveBeenCalled())
    await chooseFile()
    await chooseCategory()

    fireEvent.click(screen.getByRole('button', { name: /^Upload/ }))

    await waitFor(() => expect(uploadDocuments).toHaveBeenCalled())
    expect(await screen.findByText('Tax year must be between 2019 and 2026.')).toBeTruthy()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('still toasts a failure the sheet cannot explain', async () => {
    uploadDocuments.mockRejectedValue(new Error('Document storage is temporarily unavailable.'))

    renderSheet()
    await waitFor(() => expect(getTaxReliefCategories).toHaveBeenCalled())
    await chooseFile()
    await chooseCategory()

    fireEvent.click(screen.getByRole('button', { name: /^Upload/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalled())
    expect(showToast.mock.calls[0][2]).toBe('error')
  })

  it('offers Undo only when every uploaded document id is known', async () => {
    uploadDocuments.mockResolvedValue([{ fileName: 'receipt.pdf', uploaded: true, id: 42 }])
    bulkDeleteDocuments.mockResolvedValue([{ id: 42, deleted: true }])
    renderSheet()
    await waitFor(() => expect(getTaxReliefCategories).toHaveBeenCalled())
    await chooseFile()
    await chooseCategory()

    fireEvent.click(screen.getByRole('button', { name: /^Upload/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalled())
    const undo = showToast.mock.calls[0][3]
    expect(undo?.label).toBe('Undo')
    undo.onAction()
    // Undoing a batch upload removes the batch in one call, rather than a delete per file.
    await waitFor(() => expect(bulkDeleteDocuments).toHaveBeenCalledWith([42]))
    expect(deleteDocument).not.toHaveBeenCalled()
  })

  it('says so when Undo removes only some of the uploaded documents', async () => {
    // The bulk endpoint answers per file, so a partial removal is stated instead of being hidden
    // behind whichever request happened to reject first.
    uploadDocuments.mockResolvedValue([
      { fileName: 'receipt.pdf', uploaded: true, id: 42 },
      { fileName: 'invoice.pdf', uploaded: true, id: 43 },
    ])
    bulkDeleteDocuments.mockResolvedValue([
      { id: 42, deleted: true },
      { id: 43, deleted: false, message: 'That document is no longer in your Vault.' },
    ])
    renderSheet()
    await waitFor(() => expect(getTaxReliefCategories).toHaveBeenCalled())
    await chooseFile()
    await chooseCategory()

    fireEvent.click(screen.getByRole('button', { name: /^Upload/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalled())
    showToast.mock.calls[0][3].onAction()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('1 of 2 documents were removed'),
      'Undo Incomplete',
      'error',
    ))
  })

  it('rejects unsupported file types client-side with server explanation', async () => {
    renderSheet()
    await waitFor(() => expect(getTaxReliefCategories).toHaveBeenCalled())

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['<xml></xml>'], 'export.xml', { type: 'application/xml' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)

    expect(await screen.findByText('Upload a photo or a PDF. Other kinds of file cannot be kept as tax evidence.')).toBeTruthy()
    expect(screen.queryByText('export.xml')).toBeNull()
  })
})
