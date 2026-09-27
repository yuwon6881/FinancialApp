import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePurchaseCapture } from './usePurchaseCapture'
import { capturePrefill } from '../lib/native/capturePrefill'
import type { PurchaseCapture } from '../lib/native/purchaseCapture'

const mocks = vi.hoisted(() => ({
  activate: vi.fn(), state: vi.fn(), consumeTap: vi.fn(), update: vi.fn(),
  addListener: vi.fn(async () => ({ remove: vi.fn() })),
}))
vi.mock('../lib/native/purchaseCapture', () => ({ supportsPurchaseCapture: () => true, PurchaseCapturePlugin: mocks }))
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener } }))

const candidate = { id: 'capture', transactionId: 'transaction', sourceLabel: 'Bank', amount: '12.50', currency: 'MYR', description: 'Cafe', possibleDuplicate: false } as PurchaseCapture
const snapshot = { candidates: [candidate], packages: ['bank'], enabled: true, access: true, notifications: true, tapId: 'capture' }

describe('purchase capture routing', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.state.mockResolvedValue(snapshot); mocks.activate.mockResolvedValue(undefined) })
  it('keeps notification taps pending until unlocked', async () => {
    const open = vi.fn()
    const options = { owner: 'one', eligible: false, hidden: false, formOpen: false, currency: 'MYR', categories: [], reveal: vi.fn(), open, enqueue: vi.fn() }
    const { rerender } = renderHook(({ eligible }) => usePurchaseCapture({ ...options, eligible }), { initialProps: { eligible: false } })
    await waitFor(() => expect(mocks.state).toHaveBeenCalled())
    expect(open).not.toHaveBeenCalled()
    expect(mocks.consumeTap).not.toHaveBeenCalled()
    rerender({ eligible: true })
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.objectContaining({ captureId: 'capture', amount: '12.50' })))
    expect(mocks.consumeTap).toHaveBeenCalledWith({ owner: 'one' })
  })
  it('does not reveal a capture or consume its tap in sensitive mode', async () => {
    const reveal = vi.fn(), open = vi.fn()
    renderHook(() => usePurchaseCapture({ owner: 'one', eligible: true, hidden: true, formOpen: false, currency: 'MYR', categories: [], reveal, open, enqueue: vi.fn() }))
    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(1))
    expect(open).not.toHaveBeenCalled()
    expect(mocks.consumeTap).not.toHaveBeenCalled()
  })
  it('does not replace an existing financial form with a captured purchase', async () => {
    const open = vi.fn()
    const { result } = renderHook(() => usePurchaseCapture({ owner: 'one', eligible: true, hidden: false, formOpen: true, currency: 'MYR', categories: [], reveal: vi.fn(), open, enqueue: vi.fn() }))
    await act(async () => { await result.current.refresh() })
    expect(open).not.toHaveBeenCalled()
    expect(mocks.consumeTap).not.toHaveBeenCalled()
  })
  it('suspends capture ownership on sign-out', async () => {
    const { rerender } = renderHook(({ owner }) => usePurchaseCapture({ owner, eligible: false, hidden: false, formOpen: false, currency: 'MYR', categories: [], reveal: vi.fn(), open: vi.fn(), enqueue: vi.fn() }), { initialProps: { owner: 'one' as string | null } })
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith({ owner: 'one' }))
    rerender({ owner: null })
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith({ owner: null }))
  })
  it('leaves mismatched or unknown currency amounts blank', () => {
    expect(capturePrefill(candidate, 'USD').amount).toBeUndefined()
    expect(capturePrefill({ ...candidate, currency: undefined }, 'MYR').amount).toBeUndefined()
    expect(capturePrefill({ ...candidate, edits: { amount: '9.50' } }, 'USD').amount).toBe('9.50')
  })
  it('opens a transfer alert as an outflow purchase draft', () => {
    const prefill = capturePrefill({ ...candidate, transactionType: 'transfer' }, 'MYR')
    expect(prefill.transactionType).toBe('outflow')
    expect(prefill.transferSource).toBeUndefined()
    expect(prefill.transferTarget).toBeUndefined()
    expect(prefill.accountId).toBeUndefined()
    expect(prefill.counterAccountId).toBeUndefined()
  })
  it('preserves a reviewer-chosen transfer type and route', () => {
    const prefill = capturePrefill({
      ...candidate,
      transactionType: 'transfer',
      edits: {
        transactionType: 'transfer',
        transferSource: 'Rewards',
        transferTarget: 'Growth',
        accountId: 'source',
        counterAccountId: 'destination',
      },
    }, 'MYR')
    expect(prefill).toMatchObject({
      transactionType: 'transfer',
      transferSource: 'Rewards',
      transferTarget: 'Growth',
      accountId: 'source',
      counterAccountId: 'destination',
    })
  })
  it('dates an undated alert by its arrival in the financial time zone and says so', () => {
    const capturedAt = Date.UTC(2026, 8, 26, 17, 0) // 01:00 on 27 September in Kuala Lumpur
    const prefill = capturePrefill({ ...candidate, capturedAt }, 'MYR')
    expect(prefill.date).toBe('2026-09-27')
    expect(prefill.captureNotices).toEqual([expect.stringContaining('when the alert arrived')])
    const dated = capturePrefill({ ...candidate, capturedAt, date: '2026-09-20' }, 'MYR')
    expect(dated.date).toBe('2026-09-20')
    expect(dated.captureNotices).toEqual([])
  })
  it('opens a tapped capture even when another approval cannot be recovered yet', async () => {
    const stuck = { ...candidate, id: 'stuck', transactionId: 'stuck-tx', prepared: { amount: -5, description: 'Old', date: '2026-09-01', category: 'Food', ledgerCategory: 'Essentials' } } as PurchaseCapture
    mocks.state.mockResolvedValue({ ...snapshot, candidates: [stuck, candidate] })
    mocks.update.mockResolvedValue(stuck)
    const open = vi.fn()
    const enqueue = vi.fn(() => { throw new Error('Storage full') })
    const { result } = renderHook(() => usePurchaseCapture({ owner: 'one', eligible: true, hidden: false, formOpen: false, currency: 'MYR', categories: [], reveal: vi.fn(), open, enqueue }))
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.objectContaining({ captureId: 'capture' })))
    await waitFor(() => expect(result.current.error).toMatch(/has not reached the Ledger/))
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'stuck', action: 'complete' }))
  })
  it('opens a review requested in sensitive mode once balances are revealed', async () => {
    mocks.state.mockResolvedValue({ ...snapshot, tapId: undefined })
    const open = vi.fn(), reveal = vi.fn()
    const { result, rerender } = renderHook(({ hidden }) => usePurchaseCapture({ owner: 'one', eligible: true, hidden, formOpen: false, currency: 'MYR', categories: [], reveal, open, enqueue: vi.fn() }), { initialProps: { hidden: true } })
    await waitFor(() => expect(result.current.state).not.toBeNull())
    act(() => result.current.review(candidate))
    expect(reveal).toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    rerender({ hidden: false })
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.objectContaining({ captureId: 'capture' })))
  })
  it('checks a fresh approval against the Ledger draft rules before storing it', async () => {
    mocks.state.mockResolvedValue({ ...snapshot, tapId: undefined })
    const { result } = renderHook(() => usePurchaseCapture({ owner: 'one', eligible: true, hidden: false, formOpen: false, currency: 'MYR', categories: [], reveal: vi.fn(), open: vi.fn(), enqueue: vi.fn() }))
    const transaction = { amount: -12.5, description: 'Cafe', date: '2026-09-27', category: 'Missing', ledgerCategory: 'Essentials', accountId: 'cash' }
    await expect(result.current.actions.save('capture', transaction as never)).rejects.toThrow()
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'prepare' }))
  })
  it('announces a reviewer save once and completes the capture', async () => {
    mocks.state.mockResolvedValue({ ...snapshot, tapId: undefined })
    const transaction = { amount: -12.5, description: 'Cafe', date: '2026-09-27', category: 'Food', ledgerCategory: 'Essentials', accountId: 'cash' }
    mocks.update.mockImplementation(async ({ action }: { action: string }) => action === 'prepare' ? { ...candidate, prepared: transaction } : candidate)
    const enqueue = vi.fn(), onSaved = vi.fn()
    const categories = [{ id: 'food', name: 'Food', type: 'outflow' }] as never
    const { result } = renderHook(() => usePurchaseCapture({ owner: 'one', eligible: true, hidden: false, formOpen: false, currency: 'MYR', categories, reveal: vi.fn(), open: vi.fn(), enqueue, onSaved }))
    await act(async () => { await result.current.actions.save('capture', transaction as never) })
    expect(enqueue).toHaveBeenCalledWith('transaction', transaction)
    expect(mocks.update).toHaveBeenCalledWith({ owner: 'one', id: 'capture', action: 'complete' })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })
})
