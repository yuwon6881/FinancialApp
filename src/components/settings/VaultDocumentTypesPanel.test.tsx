import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api/documents'
import { VaultDocumentTypesPanel } from './VaultDocumentTypesPanel'

const showToast = vi.fn()
const confirm = vi.fn()

vi.mock('../../contexts/AppContext', () => ({
  useAppUi: () => ({ showToast, confirm }),
}))

vi.mock('../../lib/api/documents', () => ({
  listDocumentTypes: vi.fn(),
  addDocumentType: vi.fn(),
  deleteDocumentType: vi.fn(),
  reviewDocumentTypeCleanup: vi.fn(),
  applyDocumentTypeCleanup: vi.fn(),
}))

describe('VaultDocumentTypesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listDocumentTypes).mockResolvedValue([
      { id: 'receipt', name: 'Receipt', usageCount: 0 },
    ])
    vi.mocked(api.deleteDocumentType).mockResolvedValue()
    vi.mocked(api.addDocumentType).mockResolvedValue({ id: 'receipt', name: 'Receipt', usageCount: 0 })
  })

  it('collapses the card with the same header interaction as categories', async () => {
    render(<VaultDocumentTypesPanel />)
    await screen.findByText('Receipt')

    const header = screen.getByRole('button', { name: /Vault Document Types/i })
    expect(header.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('false')
  })

  it('uses a confirmation modal and success toast with working undo for delete', async () => {
    render(<VaultDocumentTypesPanel />)
    await screen.findByText('Receipt')

    fireEvent.click(screen.getByRole('button', { name: 'Delete Receipt' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    const request = confirm.mock.calls[0][0]
    expect(request.title).toBe('Delete Document Type')
    expect(request.confirmText).toBe('Delete')

    act(() => request.onConfirm())
    await waitFor(() => expect(api.deleteDocumentType).toHaveBeenCalledWith('receipt', undefined))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      'Receipt was deleted.',
      'Document Type Deleted',
      'success',
      expect.objectContaining({ label: 'Undo' }),
    ))

    const action = showToast.mock.calls.find(call => call[1] === 'Document Type Deleted')?.[3]
    act(() => action.onAction())
    await waitFor(() => expect(api.addDocumentType).toHaveBeenCalledWith('Receipt', 'receipt'))
    await screen.findByText('Receipt')
  })

  it('supports zero document types without invoking AI or throwing', async () => {
    vi.mocked(api.listDocumentTypes).mockResolvedValue([])
    render(<VaultDocumentTypesPanel />)

    expect(await screen.findByText('0 active document types.')).toBeTruthy()
    expect(screen.getByText('No document types yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'AI' }).hasAttribute('disabled')).toBe(true)
  })
})
