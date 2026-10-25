import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaxReliefCategoryDefinition, VaultDocument } from '../../../types'
import { TransactionDocumentsField, type TransactionDocumentsFieldRef } from './TransactionDocumentsField'

vi.mock('../../../contexts/AppContext', () => ({
  useAppPrefs: () => ({ hideSensitive: false }),
}))

let categories: TaxReliefCategoryDefinition[] = []
vi.mock('../../../lib/api/documents', () => ({
  getDocumentConstraints: async () => ({
    maxDocumentBytes: 20 * 1024 * 1024,
    maxBulkDocuments: 10,
    maxTotalBytesPerUser: 2 * 1024 * 1024 * 1024,
  }),
  getTaxReliefCategories: async () => categories,
}))

const filed: VaultDocument = {
  id: 7,
  originalFileName: 'dental-receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1000,
  taxYear: 2026,
  reliefCategory: 'dental',
  amount: 99,
  amountCurrency: 'MYR',
  amountStatus: 'Confirmed',
  uploadedAt: '2026-10-25T00:00:00Z',
  retentionUntil: '2033-12-31T00:00:00Z',
}

const renderField = (existingDocuments: VaultDocument[] = []) => {
  const ref = createRef<TransactionDocumentsFieldRef>()
  render(
    <TransactionDocumentsField
      ref={ref}
      existingDocuments={existingDocuments}
      defaultTaxYear={2026}
      transactionAmount="99"
      currency="MYR"
    />,
  )
  return ref
}

const attach = async (name = 'receipt.jpg') => {
  await vi.waitFor(() => expect((screen.getByRole('button', { name: /Attach/ }) as HTMLButtonElement).disabled).toBe(false))
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [new File(['x'], name, { type: 'image/jpeg' })], configurable: true })
  fireEvent.change(input)
  await screen.findByText(name)
}

describe('TransactionDocumentsField', () => {
  beforeEach(() => {
    categories = [
      { id: 'dental', name: 'Dental examination', limit: 1000 },
      { id: 'medical', name: 'Medical', limit: 1000 },
    ]
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('waits for a save attempt before calling a missing category an error', async () => {
    const ref = renderField()
    await attach()

    expect(screen.queryByText(/before saving/i)).toBeNull()
    expect(screen.getByRole('combobox', { name: /Tax relief category for receipt.jpg/ }).getAttribute('aria-invalid')).not.toBe('true')

    let message: string | null = null
    act(() => { message = ref.current!.getValidationError() })
    expect(message).toBe('Choose a tax relief category for receipt.jpg.')
    expect(await screen.findByText('Choose where this document counts before saving.')).toBeTruthy()
  })

  it('files a new document under the only category without asking', async () => {
    categories = [{ id: 'medical', name: 'Medical', limit: 1000 }]
    const ref = renderField()
    await attach()

    expect(ref.current!.getValidationError()).toBeNull()
    expect(ref.current!.getChanges().pending[0]).toMatchObject({ reliefCategory: 'medical', taxYear: 2026, amount: 99 })
  })

  it('stages a detach that can be undone before saving', async () => {
    const ref = renderField([filed])
    fireEvent.click(await screen.findByRole('button', { name: 'Detach dental-receipt.pdf from this transaction' }))

    expect(screen.getByText(/Detaches when you save/)).toBeTruthy()
    expect(ref.current!.getChanges().unlinkIds).toEqual([7])

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(ref.current!.getChanges().unlinkIds).toEqual([])
    expect(await screen.findByText(/Dental examination · RM\s?99\.00 · YA 2026/)).toBeTruthy()
  })
})
