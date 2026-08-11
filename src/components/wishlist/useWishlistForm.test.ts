import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useWishlistForm } from './useWishlistForm'

describe('useWishlistForm privacy resolution', () => {
  it('opens a FAB-requested editor while privacy is still pending, then closes if masking is confirmed', async () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: 'pending' | 'resolved' }) => useWishlistForm({
        wishlist: [],
        hideSensitive: true,
        sensitivePreferenceStatus: status,
        autoOpenAddModal: true,
        onResetAutoOpen: vi.fn(),
        onAddItem: vi.fn(),
        onUpdateItem: vi.fn(),
      }),
      { initialProps: { status: 'pending' as 'pending' | 'resolved' } },
    )

    await waitFor(() => expect(result.current.showAddModal).toBe(true))

    rerender({ status: 'resolved' })

    await waitFor(() => expect(result.current.showAddModal).toBe(false))
  })
})
