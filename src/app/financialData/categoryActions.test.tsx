import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createCategoryActions } from './categoryActions'
import * as api from '../../lib/api'
import type { RecurringPayment, TransactionCategory } from '../../types'

vi.mock('../../lib/api', () => ({
  fetchPagedTransactions: vi.fn(),
  reviewCategoryCleanup: vi.fn(),
}))

const sampleCategory: TransactionCategory = {
  id: 'cat-1',
  name: 'Groceries',
  type: 'outflow',
}

const replacementCategory: TransactionCategory = {
  id: 'cat-2',
  name: 'Dining Out',
  type: 'outflow',
}

const recurringPayment: RecurringPayment = {
  id: 'rp-1',
  name: 'Supermarket Subscription',
  amount: 100,
  frequency: 'Monthly',
  category: 'Groceries',
  ledgerCategory: 'Essentials',
  accountId: 'acct-1',
  nextDueDate: '2026-09-01',
  dueDate: 1,
  startDate: '2026-01-01',
  active: true,
  paymentMode: 'Manual',
  reminderEnabled: false,
  reminderMode: 'Once',
  reminderLeadDays: 0,
}

describe('createCategoryActions - requestDeleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders usage breakdown card and navigates to ledger in all-cycles mode when View in Ledger is clicked', async () => {
    vi.mocked(api.fetchPagedTransactions).mockResolvedValue({
      items: [],
      total: 5,
      page: 1,
      pageSize: 1,
      totalPages: 5,
    } as any)

    let modalData: any = null
    const setConfirmModalData = vi.fn(data => {
      modalData = typeof data === 'function' ? data(modalData) : data
    })
    const onNavigateToLedger = vi.fn()

    const actions = createCategoryActions({
      categoriesList: [sampleCategory, replacementCategory],
      allCategories: [sampleCategory, replacementCategory],
      allRecurringPayments: [recurringPayment],
      guardSensitive: () => true,
      mutateQueue: vi.fn(),
      snapshotForUndo: vi.fn(),
      setConfirmModalData,
      showToast: vi.fn(),
      onNavigateToLedger,
    })

    await actions.requestDeleteCategory('cat-1')

    expect(setConfirmModalData).toHaveBeenCalled()
    expect(modalData).not.toBeNull()
    expect(modalData.title).toBe('Delete Category')
    expect(modalData.confirmText).toBe('Transfer and Delete')

    const rendered = render(modalData.message)
    expect(rendered.getByText(/Delete/i)).toBeDefined()
    expect(rendered.getByText('5')).toBeDefined()
    expect(rendered.getByText('1')).toBeDefined()

    const viewInLedgerBtn = screen.getByRole('button', { name: /view in ledger/i })
    expect(viewInLedgerBtn).toBeDefined()

    fireEvent.click(viewInLedgerBtn)

    expect(setConfirmModalData).toHaveBeenCalledWith(null)
    expect(onNavigateToLedger).toHaveBeenCalledWith({
      category: 'Groceries',
      showAllCycles: true,
      range: 'all',
    })
  })

  it('renders safe-to-delete state when no transactions or recurring payments exist', async () => {
    vi.mocked(api.fetchPagedTransactions).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 1,
      totalPages: 0,
    } as any)

    let modalData: any = null
    const setConfirmModalData = vi.fn(data => {
      modalData = typeof data === 'function' ? data(modalData) : data
    })
    const onNavigateToLedger = vi.fn()

    const actions = createCategoryActions({
      categoriesList: [sampleCategory, replacementCategory],
      allCategories: [sampleCategory, replacementCategory],
      allRecurringPayments: [],
      guardSensitive: () => true,
      mutateQueue: vi.fn(),
      snapshotForUndo: vi.fn(),
      setConfirmModalData,
      showToast: vi.fn(),
      onNavigateToLedger,
    })

    await actions.requestDeleteCategory('cat-1')

    expect(modalData).not.toBeNull()
    expect(modalData.confirmText).toBe('Delete')

    const rendered = render(modalData.message)
    expect(rendered.getByText(/No ledger transactions or recurring payments currently use this category/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /view in ledger/i })).toBeNull()
  })
})
