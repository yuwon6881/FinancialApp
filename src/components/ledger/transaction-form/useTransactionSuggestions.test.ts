import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getSelectableCategoryNames, useTransactionSuggestions } from './useTransactionSuggestions'
import { suggestTransactionNotes } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({ suggestTransactionNotes: vi.fn(), suggestTransactionCategories: vi.fn() }))

describe('transaction category suggestion selection', () => {
  const categories = [
    { name: 'Food' },
    { name: 'Transport' },
    { name: 'Transfer' },
    { name: 'Adjustment' },
    { name: 'Archived', isPendingDelete: true },
  ]

  it('only sends normal selectable categories for ranking', () => {
    expect(getSelectableCategoryNames(categories)).toEqual(['Food', 'Transport'])
  })

  it('closes notes when switching type and ignores a late response after switching back', async () => {
    let resolve!: (value: { note: string; reason: string }[]) => void
    vi.mocked(suggestTransactionNotes).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const options = { categories, editingTxId: null, showAddForm: true, activeSuggestionEntries: [], category: 'Food', ledgerCategory: 'Essentials' }
    const { result, rerender } = renderHook(({ txType }: { txType: 'outflow' | 'transfer' }) => useTransactionSuggestions({ ...options, txType }), { initialProps: { txType: 'outflow' } })
    let pending!: Promise<void>
    act(() => { pending = result.current.requestNoteSuggestions('Coffee') })
    expect(result.current.showNoteSuggestions).toBe(true)
    rerender({ txType: 'transfer' })
    expect(result.current.showNoteSuggestions).toBe(false)
    expect(result.current.isSuggestingNote).toBe(false)
    rerender({ txType: 'outflow' })
    await act(async () => { resolve([{ note: 'Coffee house', reason: 'Cleaner' }]); await pending })
    expect(result.current.noteSuggestions).toEqual([])
    expect(result.current.showNoteSuggestions).toBe(false)
  })
})
