import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Loan } from '../../types'
import { useLoanData } from './useLoanData'

const fetchLoans = vi.fn<() => Promise<Loan[]>>()

vi.mock('../../lib/api/loans', () => ({ fetchLoans }))

const savedLoan: Loan = {
  id: 'loan-home',
  name: 'Home loan',
  recurringPaymentId: 'bill-home',
  openingPrincipal: 1000,
  trackingStartDate: '2026-01-01',
  annualRatePercent: 5,
  termPeriods: 12,
  interestMethod: 'ReducingBalance',
  scheduleStatus: 'Complete',
  snapshot: {
    outstandingBalance: 900,
    scheduledPayment: 100,
    totalScheduledInterest: 20,
    totalInterestPaid: 5,
    payments: [],
    futureSchedule: [],
  },
}

describe('useLoanData', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchLoans.mockReset()
  })

  it('does not request loans until the lazy loader is called', async () => {
    fetchLoans.mockResolvedValue([savedLoan])
    const { result } = renderHook(() => useLoanData())

    expect(result.current.status).toBe('idle')
    expect(fetchLoans).not.toHaveBeenCalled()

    await act(async () => { await result.current.load() })

    expect(fetchLoans).toHaveBeenCalledTimes(1)
    expect(result.current.loans).toEqual([savedLoan])
    expect(result.current.hasLoadedFromServer).toBe(true)
  })

  it('exposes an error and succeeds when retried', async () => {
    fetchLoans.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([savedLoan])
    const { result } = renderHook(() => useLoanData())

    await act(async () => { await expect(result.current.load()).rejects.toThrow('Offline') })
    expect(result.current.status).toBe('error')

    await act(async () => { await result.current.refresh() })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.loans).toEqual([savedLoan])
  })
})
