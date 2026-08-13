import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllModalDrafts, setModalDraft } from './modalDrafts'
import { useFormDraft } from './useFormDraft'

describe('useFormDraft', () => {
  beforeEach(() => {
    clearAllModalDrafts()
  })
  afterEach(() => {
    clearAllModalDrafts()
  })

  it('restores a saved draft by default', () => {
    setModalDraft('test-modal', { value: 'saved' })
    const onRestore = vi.fn()

    renderHook(() => useFormDraft('test-modal', false, { value: '' }, onRestore))

    expect(onRestore).toHaveBeenCalledWith({ value: 'saved' })
  })

  it('can retain a draft without reopening the sheet on mount', () => {
    setModalDraft('test-modal', { value: 'saved' })
    const onRestore = vi.fn()

    renderHook(() => useFormDraft(
      'test-modal',
      false,
      { value: '' },
      onRestore,
      { restoreOnMount: false },
    ))

    expect(onRestore).not.toHaveBeenCalled()
  })
})
