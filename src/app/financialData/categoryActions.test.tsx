import fs from 'node:fs'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createCategoryActions } from './categoryActions'
import { CategoryReplacementSelect } from '../../components/ui/CategoryReplacementSelect'
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
      allCategories: [sampleCategory, replacementCategory],
      allRecurringPayments: [recurringPayment],
      guardSensitive: () => true,
      mutateQueue: vi.fn(),
      snapshotForUndo: vi.fn(),
      setConfirmModalData,
      showToast: vi.fn(),
      onNavigateToLedger,
    })

    await actions.requestDeleteCategory('cat-1', { ReplacementSelect: CategoryReplacementSelect })

    expect(setConfirmModalData).toHaveBeenCalled()
    expect(modalData).not.toBeNull()
    expect(modalData.title).toBe('Delete Category')
    expect(modalData.confirmText).toBe('Transfer and Delete')

    const rendered = render(modalData.message)
    expect(rendered.getByText(/Delete/i)).toBeDefined()
    expect(rendered.getByText('5 transactions')).toBeDefined()
    expect(rendered.getByText('1 bill')).toBeDefined()

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
      allCategories: [sampleCategory, replacementCategory],
      allRecurringPayments: [],
      guardSensitive: () => true,
      mutateQueue: vi.fn(),
      snapshotForUndo: vi.fn(),
      setConfirmModalData,
      showToast: vi.fn(),
      onNavigateToLedger,
    })

    await actions.requestDeleteCategory('cat-1', { ReplacementSelect: CategoryReplacementSelect })

    expect(modalData).not.toBeNull()
    expect(modalData.confirmText).toBe('Delete')

    const rendered = render(modalData.message)
    expect(rendered.getByText(/No ledger transactions or recurring payments currently use this category/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /view in ledger/i })).toBeNull()
  })

  // Rows come from the optimistic projection, whose ids are whatever the server sent. A numeric id
  // reaching the handler as the string the DOM carries used to fail the strict-equality lookup, so
  // the handler returned before opening anything and the click read as doing nothing.
  it('resolves the category when the row id and the stored id differ only by type', async () => {
    vi.mocked(api.fetchPagedTransactions).mockResolvedValue({
      items: [], total: 0, page: 1, pageSize: 1, totalPages: 0,
    } as any)

    let modalData: any = null
    const actions = createCategoryActions({
      allCategories: [{ ...sampleCategory, id: 7 as unknown as string }, replacementCategory],
      allRecurringPayments: [],
      guardSensitive: () => true,
      mutateQueue: vi.fn(),
      snapshotForUndo: vi.fn(),
      setConfirmModalData: vi.fn(data => {
        modalData = typeof data === 'function' ? data(modalData) : data
      }),
      showToast: vi.fn(),
    })

    await actions.requestDeleteCategory('7', { ReplacementSelect: CategoryReplacementSelect })

    expect(modalData).not.toBeNull()
    expect(modalData.title).toBe('Delete Category')
  })
})

/**
 * The confirmation used to reach its replacement picker through React.lazy. Vite's generated
 * dependency-preload wrapper can stay pending forever for a runtime chunk, and when it did the
 * modal sat on a "Loading categories..." fallback with no control to choose a replacement -- so
 * the delete could never be confirmed. The tests above render the message and assert only its
 * text, which a permanently-suspended control passes. These assert the control itself.
 */
describe('createCategoryActions - replacement picker availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.fetchPagedTransactions).mockResolvedValue({
      items: [], total: 1, page: 1, pageSize: 1, totalPages: 1,
    } as any)
  })

  const openConfirmation = async (mutateQueue = vi.fn()) => {
    let modalData: any = null
    const setConfirmModalData = vi.fn(data => {
      modalData = typeof data === 'function' ? data(modalData) : data
    })
    const actions = createCategoryActions({
      allCategories: [sampleCategory, replacementCategory],
      allRecurringPayments: [],
      guardSensitive: () => true,
      mutateQueue,
      snapshotForUndo: vi.fn(),
      setConfirmModalData,
      showToast: vi.fn(),
    })
    await actions.requestDeleteCategory('cat-1', { ReplacementSelect: CategoryReplacementSelect })
    return { modal: () => modalData, setConfirmModalData }
  }

  const chooseReplacement = () => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Replacement category' }))
    fireEvent.click(screen.getByRole('option', { name: replacementCategory.name }))
  }

  it('renders an interactive replacement picker on the first open, with no loading fallback', async () => {
    const { modal } = await openConfirmation()

    // Rendered synchronously, with no act/flush: nothing in this path may await a runtime import.
    const rendered = render(modal().message)

    expect(rendered.queryByText(/loading categories/i)).toBeNull()
    const picker = screen.getByRole('combobox', { name: 'Replacement category' })
    expect(picker.textContent).toMatch(/choose replacement category/i)
    rendered.unmount()
  })

  it('enables the confirm button once a replacement is chosen', async () => {
    const { modal, setConfirmModalData } = await openConfirmation()
    expect(modal().confirmDisabled).toBe(true)

    const rendered = render(modal().message)
    chooseReplacement()

    expect(setConfirmModalData).toHaveBeenCalledTimes(2)
    expect(modal().confirmDisabled).toBe(false)
    rendered.unmount()
  })

  it('carries the chosen replacement into the queued delete', async () => {
    const mutateQueue = vi.fn()
    const { modal } = await openConfirmation(mutateQueue)

    const rendered = render(modal().message)
    chooseReplacement()
    modal().onConfirm()

    expect(mutateQueue).toHaveBeenCalledTimes(1)
    const projected = mutateQueue.mock.calls[0][0]([])
    expect(JSON.stringify(projected)).toContain(replacementCategory.id)
    rendered.unmount()
  })
})

/**
 * Structural, not behavioural: the eager shell must not carry the picker, and the confirmation
 * must not fetch it at runtime either. Neither regression is visible to a rendering test -- the
 * first shows up only in scripts/check-bundle-size.js, the second only on a cold first open in a
 * real browser -- so the boundary is asserted against the source.
 */
describe('delete-category confirmation module boundaries', () => {
  const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')

  it('neither imports nor lazily loads the picker from the eager financial-data chunk', () => {
    const source = read('./categoryActions.tsx')
    expect(source).not.toMatch(/from '.*CategoryReplacementSelect/)
    expect(source).not.toMatch(/\blazy\s*\(/)
    expect(source).not.toMatch(/\bimport\s*\(/)
    expect(source).toContain('ReplacementSelect')
  })

  it('loads the picker statically from the already-lazy Settings chunk', () => {
    const source = read('../../components/settings/view/useSettingsView.ts')
    expect(source).toContain("import { CategoryReplacementSelect } from '../../ui/CategoryReplacementSelect'")
    expect(source).toContain('ReplacementSelect: CategoryReplacementSelect')
  })

  it('renders the confirmation modal without a runtime import', () => {
    const source = read('../AppOverlays.tsx')
    expect(source).toContain("import { CustomConfirmModal } from '../components/ui/CustomConfirmModal'")
    expect(source).not.toMatch(/lazy\(\(\) => import\('\.\.\/components\/ui\/CustomConfirmModal'\)/)
  })
})
