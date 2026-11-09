import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { createRef } from 'react'
import { canOpenBlankMutationForm, canOpenTransactionForm } from '@/lib/quickAddAvailability'
import { SENSITIVE_AMOUNT_MASK } from '@/lib/utils'
import { AppProvider } from '@/contexts/AppProvider'
import { LedgerView } from '@/components/LedgerView'
import { DetectedTransactionsSheet } from '@/components/settings/transaction-detection/DetectedTransactionsSheet'
import { TransactionFormSheet, type TransactionFormSheetRef } from '@/components/ledger/TransactionFormSheet'
import { useTransactionFormSubmit } from '@/components/ledger/transaction-form/useTransactionFormSubmit'
import type { PurchaseCapture } from '@/lib/native/purchaseCapture'
import type { LedgerAccount, TransactionCategory } from '@/types'
import { useAppRootContext } from '@/app/useAppRootContext'

describe('pre-wake sensitive mode compatibility', () => {
  it('keeps new transactions open unconditionally while gating other blank mutation forms once sensitive mode resolves', () => {
    expect(canOpenTransactionForm(true, 'pending')).toBe(true)
    expect(canOpenTransactionForm(true, 'unavailable')).toBe(true)
    expect(canOpenTransactionForm(true, 'resolved')).toBe(true)
    expect(canOpenTransactionForm(false, 'resolved')).toBe(true)

    // Before server responds (pending), non-transaction forms are allowed if unblocked
    expect(canOpenBlankMutationForm(true, 'pending')).toBe(true)
    // Once bootstrap fails or resolves with hideSensitive: true, bills/rewards/investments/scans stay gated
    expect(canOpenBlankMutationForm(true, 'unavailable')).toBe(false)
    expect(canOpenBlankMutationForm(true, 'resolved')).toBe(false)
    // When revealed
    expect(canOpenBlankMutationForm(false, 'resolved')).toBe(true)
  })

  it('masks candidate amounts with SENSITIVE_AMOUNT_MASK in DetectedTransactionsSheet when hideSensitive is true', () => {
    const candidate: PurchaseCapture = {
      id: 'cap-1',
      transactionId: 'tx-cap-1',
      sourcePackage: 'com.bank.app',
      sourceLabel: 'Maybank',
      capturedAt: Date.now(),
      excerpt: 'Paid MYR 89.50',
      amount: '89.50',
      currency: 'MYR',
      description: 'Supermarket Groceries',
      possibleDuplicate: false,
    }

    const onReview = vi.fn()
    const onDiscard = vi.fn().mockResolvedValue(true)

    // Render in sensitive mode (hideSensitive: true)
    const { rerender } = render(
      <DetectedTransactionsSheet
        isOpen={true}
        onClose={vi.fn()}
        candidates={[candidate]}
        busy={false}
        formOpen={false}
        hideSensitive={true}
        onReview={onReview}
        onDiscard={onDiscard}
      />
    )

    // SENSITIVE_AMOUNT_MASK must be visible in DOM
    expect(screen.getByText(SENSITIVE_AMOUNT_MASK)).toBeTruthy()
    // Cleartext amount must NOT appear anywhere in the document
    expect(screen.queryByText(/89\.50/)).toBeNull()
    // Merchant description is visible
    expect(screen.getByText('Supermarket Groceries')).toBeTruthy()

    // Clicking Review calls onReview callback
    const reviewBtn = screen.getByRole('button', { name: /Review Supermarket Groceries/i })
    fireEvent.click(reviewBtn)
    expect(onReview).toHaveBeenCalledWith(candidate)

    // When revealed (hideSensitive: false), cleartext amount displays
    rerender(
      <DetectedTransactionsSheet
        isOpen={true}
        onClose={vi.fn()}
        candidates={[candidate]}
        busy={false}
        formOpen={false}
        hideSensitive={false}
        onReview={onReview}
        onDiscard={onDiscard}
      />
    )

    expect(screen.queryByText(SENSITIVE_AMOUNT_MASK)).toBeNull()
    expect(screen.getByText(/89\.50/)).toBeTruthy()
  })

  it('enables Save button on TransactionFormSheet in create mode under sensitive mode and security pending', () => {
    const mockAccounts: LedgerAccount[] = [
      {
        id: 'acc-essentials-1',
        name: 'Checking Account',
        bucket: 'Essentials',
        kind: 'Bank',
        remaining: 2500,
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]

    const mockCategories: TransactionCategory[] = [
      { id: 'groceries', name: 'Groceries', type: 'outflow' },
    ]

    const ref = createRef<TransactionFormSheetRef>()

    render(
      <TransactionFormSheet
        ref={ref}
        hideSensitive={true}
        sensitivePreferenceStatus="pending"
        currency="USD"
        accounts={mockAccounts}
        accountsLoading={false}
        categories={mockCategories}
        selectedMonth="11"
        selectedYear={2026}
        autocompleteSuggestions={[]}
        transactions={[]}
        essentialsAlloc={50}
        growthAlloc={20}
        stabilityAlloc={20}
        rewardsAlloc={10}
        cycleDay={1}
        stabilityBalance={1000}
        stabilityTarget={2000}
        stabilityOverflowRedirect="Essentials"
        onAddTransaction={vi.fn().mockResolvedValue(undefined)}
      />
    )

    act(() => {
      ref.current?.openFresh()
    })

    // The Save button should NOT be disabled solely because sensitive mode is active
    const submitBtn = screen.getByRole('button', { name: /Add Transaction/i })
    expect(submitBtn.hasAttribute('disabled')).toBe(false)
    expect(submitBtn.getAttribute('title')).toBeNull()
    expect(screen.queryByText(/saving is temporarily disabled/i)).toBeNull()

    // Historical edits remain blocked while hideSensitive is true
    act(() => {
      ref.current?.handleStartEdit({
        id: 'tx-historical-1',
        description: 'Historical Item',
        amount: -25,
        date: '2026-11-01',
        category: 'Groceries',
        ledgerCategory: 'Essentials',
        accountId: 'acc-essentials-1',
      })
    })
    expect(screen.queryByRole('heading', { name: 'Edit Transaction' })).toBeNull()
  })

  it('allows submitting create mode form in useTransactionFormSubmit under sensitive mode while blocking edit mode', async () => {
    const dispatch = vi.fn()
    const onAddTransaction = vi.fn().mockResolvedValue(undefined)
    const onUpdateTransaction = vi.fn().mockResolvedValue(undefined)

    const accounts: LedgerAccount[] = [
      {
        id: 'acc-1',
        name: 'Checking',
        bucket: 'Essentials',
        kind: 'Bank',
        remaining: 100,
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]

    // 1. Create Mode in sensitive mode:
    const createState: any = {
      mode: 'create',
      description: 'Lunch',
      amount: '15.00',
      date: '2026-11-09',
      transactionType: 'outflow',
      ledgerCategory: 'Essentials',
      category: 'Food',
      accountId: 'acc-1',
      counterAccountId: null,
      splitAccountIds: {},
      stabilityReloadIntent: 'Unanswered',
    }

    const { result: createHook } = renderHook(() =>
      useTransactionFormSubmit({
        state: createState,
        dispatch,
        accountsLoading: false,
        accounts,
        hideSensitive: true,
        sensitivePreferenceStatus: 'pending',
        resolveAcceptedTopUp: () => 0,
        savedTopUpMovedAcrossCycles: false,
        topUpOffer: null,
        documentsFieldRef: { current: null },
        isRecoveryCycleDate: false,
        stabilityTopUpContext: undefined,
        essentialsAlloc: 50,
        growthAlloc: 20,
        stabilityAlloc: 20,
        rewardsAlloc: 10,
        stabilityBalance: 1000,
        stabilityTarget: 2000,
        stabilityOverflowRedirect: 'Essentials',
        todayDate: '2026-11-09',
        clearFormDraft: vi.fn(),
        scanner: { clearScan: vi.fn() },
        cycleDay: 1,
        onAddTransaction,
        onUpdateTransaction,
      })
    )

    const fakeEvent = { preventDefault: vi.fn(), currentTarget: {} } as any
    await act(async () => {
      await createHook.current.handleSubmit(fakeEvent)
    })

    // onAddTransaction is called; no sensitive error dispatched
    expect(onAddTransaction).toHaveBeenCalledTimes(1)
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'SET_ERRORS',
      errors: expect.objectContaining({ submit: expect.stringMatching(/security check|sensitive/i) }),
    }))

    // 2. Edit Mode in sensitive mode:
    const editState: any = {
      ...createState,
      mode: 'edit',
      editingId: 'tx-historical-1',
    }

    const { result: editHook } = renderHook(() =>
      useTransactionFormSubmit({
        state: editState,
        dispatch,
        accountsLoading: false,
        accounts,
        hideSensitive: true,
        sensitivePreferenceStatus: 'pending',
        resolveAcceptedTopUp: () => 0,
        savedTopUpMovedAcrossCycles: false,
        topUpOffer: null,
        documentsFieldRef: { current: null },
        isRecoveryCycleDate: false,
        stabilityTopUpContext: undefined,
        essentialsAlloc: 50,
        growthAlloc: 20,
        stabilityAlloc: 20,
        rewardsAlloc: 10,
        stabilityBalance: 1000,
        stabilityTarget: 2000,
        stabilityOverflowRedirect: 'Essentials',
        todayDate: '2026-11-09',
        clearFormDraft: vi.fn(),
        scanner: { clearScan: vi.fn() },
        cycleDay: 1,
        onAddTransaction,
        onUpdateTransaction,
      })
    )

    await act(async () => {
      await editHook.current.handleSubmit(fakeEvent)
    })

    // In edit mode, sensitive gating remains strictly enforced!
    expect(onUpdateTransaction).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_ERRORS',
      errors: { submit: 'Finishing security check…' },
    })
  })

  it('allows safe transaction mutations in useAppRootContext while sensitive mode is active', () => {
    const queueMutationMock = vi.fn().mockReturnValue(true)
    const guardSensitiveMock = vi.fn().mockReturnValue(false) // Sensitive mode is active!

    const mockPrefs = {
      hideSensitive: true,
      maskPassiveFinancialFigures: true,
      sensitivePreferenceStatus: 'pending' as const,
      darkMode: false,
    } as any

    const mockFinancial = {
      optimisticDashboardData: null,
      activeSyncId: null,
      activeSyncIds: [],
      deletingTxId: null,
      isBackgroundSyncing: false,
      isOffline: false,
      formatSensitive: (val: number) => String(val),
      pendingOps: [],
      activeOps: [],
      failedOps: [],
      queueMutation: queueMutationMock,
    } as any

    const mockDialogs = {
      showToast: vi.fn(),
      setConfirmModalData: vi.fn(),
    } as any

    const { result } = renderHook(() =>
      useAppRootContext({
        prefs: mockPrefs,
        financial: mockFinancial,
        dialogs: mockDialogs,
        guardSensitive: guardSensitiveMock,
      })
    )

    // Safe transaction:add is allowed even when guardSensitive() returns false
    const addResult = result.current.queueMutation!('transaction', 'add', 'tx-1', { amount: -10 })
    expect(addResult).toBe(true)
    expect(queueMutationMock).toHaveBeenCalledWith('transaction', 'add', 'tx-1', { amount: -10 }, undefined)

    // Safe transaction:bulkAdd is also allowed
    const bulkResult = result.current.queueMutation!('transaction', 'bulkAdd', 'tx-2', { transactions: [] })
    expect(bulkResult).toBe(true)

    // Unsafe or other mutations (e.g. updating an account or settings) are blocked by guardSensitive
    const unsafeResult = result.current.queueMutation!('ledgerAccount', 'delete', 'acc-1')
    expect(unsafeResult).toBe(false)
    expect(guardSensitiveMock).toHaveBeenCalled()
  })

  it('keeps an open create transaction form in LedgerView open when server resolves hideSensitive: true, while still closing edit mode on hideSensitive', () => {
    const accounts: LedgerAccount[] = [
      {
        id: 'acc-essentials-1',
        name: 'Checking',
        bucket: 'Essentials',
        kind: 'Bank',
        remaining: 1500,
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    const categories: TransactionCategory[] = [
      { id: 'cat-food', name: 'Food', type: 'outflow' },
    ]

    const renderLedger = (hideSensitive: boolean, sensitivePreferenceStatus: 'pending' | 'resolved' | 'unavailable') => (
      <AppProvider
        value={{
          hideSensitive,
          maskPassiveFinancialFigures: hideSensitive,
          sensitivePreferenceStatus,
          currency: 'USD',
          darkMode: false,
          activeSyncId: null,
          deletingId: null,
          isSyncing: false,
          isOffline: false,
          formatSensitive: val => `$${val}`,
          showToast: vi.fn(),
          guardSensitive: () => !hideSensitive,
          confirm: vi.fn(),
          operations: [],
          queueMutation: vi.fn(),
        }}
      >
        <LedgerView
          transactions={[]}
          accounts={accounts}
          categories={categories}
          selectedMonth="Nov"
          selectedYear={2026}
          cycleDay={1}
          incomingCategory={null}
          showAllCycles={false}
          onShowAllCyclesChange={vi.fn()}
          onAddTransaction={vi.fn()}
          onDeleteTransaction={vi.fn()}
          hideSensitive={hideSensitive}
        />
      </AppProvider>
    )

    // 1. Boot with hideSensitive: true and sensitivePreferenceStatus: 'pending'
    const { rerender, unmount } = render(renderLedger(true, 'pending'))

    // Open create form from LedgerToolbar
    fireEvent.click(screen.getByRole('button', { name: 'Post Transaction' }))
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeTruthy()

    const descInput = screen.getByPlaceholderText(/Grocery Store/i) as HTMLInputElement
    const amountInput = screen.getByLabelText(/Amount/i) as HTMLInputElement
    fireEvent.change(descInput, { target: { value: 'Morning Coffee' } })
    fireEvent.change(amountInput, { target: { value: '12.50' } })

    // 2. Server resolves hideSensitive: true (sensitivePreferenceStatus: 'pending' -> 'resolved')
    rerender(renderLedger(true, 'resolved'))
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeTruthy()
    expect((screen.getByPlaceholderText(/Grocery Store/i) as HTMLInputElement).value).toBe('Morning Coffee')
    expect((screen.getByLabelText(/Amount/i) as HTMLInputElement).value).toBe('12.50')

    // 3. Preference resolution unavailable also keeps the open create form intact
    rerender(renderLedger(true, 'unavailable'))
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeTruthy()
    expect((screen.getByPlaceholderText(/Grocery Store/i) as HTMLInputElement).value).toBe('Morning Coffee')
    unmount()

    // 4. Historical transaction edit mode STILL closes immediately when hideSensitive flips false -> true
    const formRef = createRef<TransactionFormSheetRef>()
    const renderSheet = (hideSensitive: boolean) => (
      <TransactionFormSheet
        ref={formRef}
        hideSensitive={hideSensitive}
        sensitivePreferenceStatus="resolved"
        currency="USD"
        accounts={accounts}
        accountsLoading={false}
        categories={categories}
        selectedMonth="Nov"
        selectedYear={2026}
        autocompleteSuggestions={[]}
        transactions={[]}
        essentialsAlloc={50}
        growthAlloc={20}
        stabilityAlloc={20}
        rewardsAlloc={10}
        cycleDay={1}
        stabilityBalance={1000}
        stabilityTarget={2000}
        stabilityOverflowRedirect="Essentials"
        onAddTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
      />
    )
    const { rerender: rerenderSheet } = render(renderSheet(false))
    act(() => {
      formRef.current?.handleStartEdit({
        id: 'tx-historical-1',
        description: 'Historical Item',
        amount: -25,
        date: '2026-11-01',
        category: 'Food',
        ledgerCategory: 'Essentials',
        accountId: 'acc-essentials-1',
      })
    })
    expect(screen.getByRole('heading', { name: 'Edit Transaction' })).toBeTruthy()

    rerenderSheet(renderSheet(true))
    expect(screen.queryByRole('heading', { name: 'Edit Transaction' })).toBeNull()
  })
})
