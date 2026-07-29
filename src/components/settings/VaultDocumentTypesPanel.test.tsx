import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api/documents'
import { VaultDocumentTypesPanel } from './VaultDocumentTypesPanel'

const showToast = vi.fn()
const confirm = vi.fn()
const queueMutation = vi.fn()
const syncContext = {
  activeSyncId: null as string | null,
  deletingId: null as string | null,
  operations: [] as import('../../lib/outbox').QueuedOp[],
  queueMutation,
}

vi.mock('../../contexts/AppContext', () => ({
  useAppUi: () => ({ showToast, confirm }),
  useAppSync: () => syncContext,
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
    syncContext.activeSyncId = null
    syncContext.deletingId = null
    syncContext.operations = []
    localStorage.clear()
  })

  it('collapses the card with the same header interaction as categories', async () => {
    render(<VaultDocumentTypesPanel />)
    await screen.findByText('Receipt')

    const header = screen.getByRole('button', { name: /Vault Document Types/i })
    expect(header.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('false')
  })

  it('queues a named, undoable delete through the shared offline outbox', async () => {
    render(<VaultDocumentTypesPanel />)
    await screen.findByText('Receipt')

    fireEvent.click(screen.getByRole('button', { name: 'Delete Receipt' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    const request = confirm.mock.calls[0][0]
    expect(request.title).toBe('Delete Document Type')
    expect(request.confirmText).toBe('Delete')

    act(() => request.onConfirm())
    expect(queueMutation).toHaveBeenCalledWith(
      'vaultDocumentType',
      'delete',
      'receipt',
      expect.objectContaining({
        name: 'Receipt',
        undoSnapshot: expect.objectContaining({ id: 'receipt', name: 'Receipt' }),
      }),
    )
    expect(api.deleteDocumentType).not.toHaveBeenCalled()
  })

  it('shows the same deleting wording and spinner status used by category rows', async () => {
    syncContext.activeSyncId = 'receipt'
    syncContext.deletingId = 'receipt'
    syncContext.operations = [{
      id: 'op-delete',
      entity: 'vaultDocumentType',
      type: 'delete',
      targetId: 'receipt',
      payload: { name: 'Receipt' },
      createdAt: 1,
      retryCount: 0,
    }]

    render(<VaultDocumentTypesPanel />)
    await screen.findByText('Receipt')
    expect(screen.getByTitle('Deleting document type...')).toBeTruthy()
    expect(screen.getByText('Deleting...')).toBeTruthy()
  })

  it('shows the queued document type with syncing wording while an add is active', async () => {
    syncContext.activeSyncId = 'doc-type-1'
    syncContext.operations = [{
      id: 'op-add',
      entity: 'vaultDocumentType',
      type: 'add',
      targetId: 'doc-type-1',
      payload: { id: 'doc-type-1', name: 'Invoice', usageCount: 0 },
      createdAt: 1,
      retryCount: 0,
    }]

    render(<VaultDocumentTypesPanel />)
    await screen.findByText('Invoice')
    expect(screen.getByTitle('Updating document type...')).toBeTruthy()
    expect(screen.getByText('Syncing...')).toBeTruthy()
  })

  it('supports zero document types without invoking AI or throwing', async () => {
    vi.mocked(api.listDocumentTypes).mockResolvedValue([])
    render(<VaultDocumentTypesPanel />)

    expect(await screen.findByText('0 active document types.')).toBeTruthy()
    expect(screen.getByText('No document types yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'AI' }).hasAttribute('disabled')).toBe(true)
  })
})
