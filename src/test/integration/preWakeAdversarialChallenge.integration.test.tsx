import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createRef } from 'react'
import { SENSITIVE_AMOUNT_MASK } from '@/lib/utils'
import { DetectedTransactionsSheet } from '@/components/settings/transaction-detection/DetectedTransactionsSheet'
import { TransactionFormSheet, type TransactionFormSheetRef } from '@/components/ledger/TransactionFormSheet'
import { createLedgerAccountActions } from '@/app/financialData/accountActions'
import { createLoanActions } from '@/app/financialData/loanActions'
import { enqueue, type QueuedOp } from '@/lib/outbox'
import type { PurchaseCapture } from '@/lib/native/purchaseCapture'
import type { LedgerAccount, TransactionCategory, Loan, RecurringPayment } from '@/types'

describe('Empirical Adversarial Challenge: Pre-Wake Sensitive Mode & Action Gating', () => {

  describe('Adversarial Privacy Leak Inspection: DetectedTransactionsSheet', () => {
    const adversarialCandidates: PurchaseCapture[] = [
      {
        id: 'cap-myr-1',
        transactionId: 'tx-myr-1',
        sourcePackage: 'com.bank.myr',
        sourceLabel: 'Maybank',
        capturedAt: Date.now() - 1000,
        excerpt: 'Paid MYR 89.50 at Grocer',
        amount: '89.50',
        currency: 'MYR',
        description: 'Grocer Mart',
        possibleDuplicate: false,
      },
      {
        id: 'cap-usd-large',
        transactionId: 'tx-usd-2',
        sourcePackage: 'com.bank.usd',
        sourceLabel: 'Chase',
        capturedAt: Date.now() - 2000,
        excerpt: 'Paid USD 1,250,000.00 to Broker',
        amount: '1250000.00',
        currency: 'USD',
        description: 'Prime Brokerage',
        possibleDuplicate: false,
      },
      {
        id: 'cap-eur-cents',
        transactionId: 'tx-eur-3',
        sourcePackage: 'com.bank.eur',
        sourceLabel: 'BNP',
        capturedAt: Date.now() - 3000,
        excerpt: 'Paid EUR 0.01 test charge',
        amount: '0.01',
        currency: 'EUR',
        description: 'Micro Test Charge',
        possibleDuplicate: true,
      },
      {
        id: 'cap-gbp-neg',
        transactionId: 'tx-gbp-4',
        sourcePackage: 'com.bank.gbp',
        sourceLabel: 'Barclays',
        capturedAt: Date.now() - 4000,
        excerpt: 'Refund GBP 45.00',
        amount: '-45.00',
        currency: 'GBP',
        description: 'Apparel Return',
        possibleDuplicate: false,
        prepared: {
          date: '2026-11-09',
          description: 'Apparel Return',
          amount: 45.0,
          category: 'Shopping',
          ledgerCategory: 'Essentials',
        },
      },
      {
        id: 'cap-jpy-zero',
        transactionId: 'tx-jpy-5',
        sourcePackage: 'com.bank.jpy',
        sourceLabel: 'SMBC',
        capturedAt: Date.now() - 5000,
        excerpt: 'Paid JPY 0 sample',
        amount: '0',
        currency: 'JPY',
        description: 'Zero Auth Sample',
        possibleDuplicate: false,
      },
      {
        id: 'cap-no-amount',
        transactionId: 'tx-no-amt-6',
        sourcePackage: 'com.bank.empty',
        sourceLabel: 'Card Alert',
        capturedAt: Date.now() - 6000,
        excerpt: 'Card transaction detected',
        amount: undefined,
        currency: 'USD',
        description: 'No Amount Merchant',
        possibleDuplicate: false,
      },
      {
        id: 'cap-nan-amount',
        transactionId: 'tx-nan-7',
        sourcePackage: 'com.bank.corrupt',
        sourceLabel: 'Corrupt Bank',
        capturedAt: Date.now() - 7000,
        excerpt: 'Corrupt',
        amount: 'not-a-number',
        currency: 'USD',
        description: 'Corrupt Amount Entry',
        possibleDuplicate: false,
      },
    ]

    it('rigorously shields all candidate amounts, numbers, and symbols in DOM text and attributes under hideSensitive', () => {
      const onReview = vi.fn()
      const onDiscard = vi.fn().mockResolvedValue(true)

      const { container, rerender } = render(
        <DetectedTransactionsSheet
          isOpen={true}
          onClose={vi.fn()}
          candidates={adversarialCandidates}
          busy={false}
          formOpen={false}
          hideSensitive={true}
          onReview={onReview}
          onDiscard={onDiscard}
        />
      )

      // 1. Verify SENSITIVE_AMOUNT_MASK is rendered for all 7 candidates under hideSensitive (unconditional masking prevents metadata leakage)
      const maskElements = screen.getAllByText(SENSITIVE_AMOUNT_MASK)
      expect(maskElements).toHaveLength(7)

      // 2. Cleartext "Amount not shown" is not shown under hideSensitive because all candidate values are masked
      expect(screen.queryByText('Amount not shown')).toBeNull()

      // 3. Exhaustive search across entire rendered DOM tree:
      // Verify that none of the private monetary amounts leak anywhere (in text, aria-label, title, or any attribute)
      const sensitiveNumbers = ['89.50', '1,250,000', '1250000', '0.01', '45.00', '-45']
      const allElements = container.querySelectorAll('*')

      for (const el of allElements) {
        for (const rawNum of sensitiveNumbers) {
          // Text content check:
          expect(el.textContent).not.toContain(rawNum)
          // Attribute check:
          for (const attr of el.attributes) {
            expect(attr.value, `Attribute "${attr.name}" on <${el.tagName}> leaked sensitive number "${rawNum}"`).not.toContain(rawNum)
          }
        }
      }

      // 4. Verify Review and Discard handlers function under sensitive mode
      const reviewFirst = screen.getByRole('button', { name: /Review Grocer Mart/i })
      fireEvent.click(reviewFirst)
      expect(onReview).toHaveBeenCalledWith(adversarialCandidates[0])

      const discardButtons = screen.getAllByRole('button', { name: /Discard/i })
      fireEvent.click(discardButtons[0])
      expect(onDiscard).toHaveBeenCalledWith(adversarialCandidates[0].id)

      // 5. Dynamic reveal test: unmasking reveals raw numbers and displays "Amount not shown" for candidates without amount
      rerender(
        <DetectedTransactionsSheet
          isOpen={true}
          onClose={vi.fn()}
          candidates={adversarialCandidates}
          busy={false}
          formOpen={false}
          hideSensitive={false}
          onReview={onReview}
          onDiscard={onDiscard}
        />
      )
      expect(screen.queryAllByText(SENSITIVE_AMOUNT_MASK)).toHaveLength(0)
      expect(screen.getByText(/89\.50/)).toBeTruthy()
      expect(screen.getAllByText('Amount not shown')).toHaveLength(2)

      // 6. Dynamic re-mask test: toggling hideSensitive back to true immediately masks everything again
      rerender(
        <DetectedTransactionsSheet
          isOpen={true}
          onClose={vi.fn()}
          candidates={adversarialCandidates}
          busy={false}
          formOpen={false}
          hideSensitive={true}
          onReview={onReview}
          onDiscard={onDiscard}
        />
      )
      expect(screen.getAllByText(SENSITIVE_AMOUNT_MASK)).toHaveLength(7)
      expect(screen.queryByText(/89\.50/)).toBeNull()
    })
  })

  describe('Adversarial Blank Form Privacy: TransactionFormSheet & BucketImpactLine', () => {
    const mockAccounts: LedgerAccount[] = [
      {
        id: 'acc-check-777',
        name: 'Secret Checking',
        bucket: 'Essentials',
        kind: 'Bank',
        remaining: 7777.77,
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'acc-save-888',
        name: 'Private Savings',
        bucket: 'Growth',
        kind: 'Bank',
        remaining: 8888.88,
        isArchived: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]

    const mockCategories: TransactionCategory[] = [
      { id: 'cat-groceries', name: 'Groceries', type: 'outflow' },
      { id: 'cat-dining', name: 'Dining Out', type: 'outflow' },
    ]

    const baseFormProps = {
      hideSensitive: true,
      sensitivePreferenceStatus: 'resolved' as const,
      currency: 'USD',
      accounts: mockAccounts,
      accountsLoading: false,
      categories: mockCategories,
      selectedMonth: '11',
      selectedYear: 2026,
      autocompleteSuggestions: [],
      transactions: [],
      essentialsAlloc: 50,
      growthAlloc: 20,
      stabilityAlloc: 20,
      rewardsAlloc: 10,
      cycleDay: 1,
      stabilityBalance: 1000,
      stabilityTarget: 2000,
      stabilityOverflowRedirect: 'Essentials',
      onAddTransaction: vi.fn().mockResolvedValue(undefined),
      ledgerSummaries: [
        {
          name: 'Essentials',
          category: 'Essentials',
          spent: 500,
          budget: 1500,
          remaining: 1000,
          target: 1500,
          percentage: 33.3,
          bucket: 'Essentials',
          netChange: -500,
          allocation: 0.5,
          incomeAllocated: 500,
        },
      ],
    }

    it('preserves privacy masking on BucketImpactLine when amount is entered and never leaks account balances', () => {
      const ref = createRef<TransactionFormSheetRef>()

      render(
        <TransactionFormSheet
          ref={ref}
          {...baseFormProps}
        />
      )

      act(() => {
        ref.current?.openFresh()
      })

      // Select Essentials bucket under "From bucket"
      const essentialsBucketBtn = screen.getByRole('radio', { name: /^Essentials$/i })
      fireEvent.click(essentialsBucketBtn)

      // 1. Check account balances are never rendered in account select or chips
      expect(screen.queryByText(/7777\.77/)).toBeNull()
      expect(screen.queryByText(/8888\.88/)).toBeNull()
      expect(document.body.innerHTML).not.toContain('7777.77')
      expect(document.body.innerHTML).not.toContain('8888.88')

      // Account name is present
      expect(screen.getByText('Secret Checking')).toBeTruthy()

      // 2. Type an outflow amount into the form:
      const amountInput = screen.getByLabelText(/Amount/i)
      fireEvent.change(amountInput, { target: { value: '250.00' } })

      // 3. Inspect BucketImpactLine:
      const bucketLine = document.body.querySelector('[role="status"][aria-live="polite"]')
      expect(bucketLine).not.toBeNull()

      // The bucket impact line must render masked amount components
      const sensitiveMasks = bucketLine!.querySelectorAll('[aria-label="Sensitive amount hidden"]')
      expect(sensitiveMasks.length).toBeGreaterThanOrEqual(2) // Before and After impact

      // Mask string "......" must be present in the bucket impact line
      expect(bucketLine!.textContent).toContain(SENSITIVE_AMOUNT_MASK)

      // Ensure no raw calculated bucket numbers (e.g. 1000, 750, etc.) appear unmasked in the impact line
      expect(bucketLine!.textContent).not.toMatch(/\$1[,.]000/)
      expect(bucketLine!.textContent).not.toMatch(/\$750/)

      // 4. Overdrawing amount test:
      fireEvent.change(amountInput, { target: { value: '99999.00' } })

      // BucketLine still exists and remains strictly masked
      const updatedBucketLine = document.body.querySelector('[role="status"][aria-live="polite"]')
      expect(updatedBucketLine).not.toBeNull()
      const updatedMasks = updatedBucketLine!.querySelectorAll('[aria-label="Sensitive amount hidden"]')
      expect(updatedMasks.length).toBeGreaterThanOrEqual(2)
      expect(updatedBucketLine!.textContent).toContain(SENSITIVE_AMOUNT_MASK)
      // Check that deficit balance AND negative overdrawn red color oracle are NOT leaked
      expect(updatedBucketLine!.textContent).not.toMatch(/98[,.]999/)
      expect(updatedBucketLine!.querySelector('.text-red-600')).toBeNull()
    })
  })

  describe('Adversarial Unsafe Action Gating: Strict Closure & Concurrency Stress', () => {
    it('fails closed and blocks handleReconcileAccounts, handleAdvanceRepayment, and handleFullSettlement when isServerAwakeRef.current === false', async () => {
      let queue: QueuedOp[] = []
      const mutateQueue = vi.fn((updater: (q: QueuedOp[]) => QueuedOp[]) => {
        queue = updater(queue)
      })
      const showToast = vi.fn()
      const isServerAwakeRef = { current: false }

      const sampleLoan: Loan = {
        id: 'adversarial-loan-1',
        name: 'Home Loan',
        recurringPaymentId: 'rp-loan-1',
        openingPrincipal: 500000,
        trackingStartDate: '2026-01-01',
        annualRatePercent: 3.5,
        termPeriods: 360,
        interestMethod: 'ReducingBalance',
        rateBasis: 'Yearly',
        scheduleFrequency: 'Monthly',
        scheduleDueDay: 1,
        scheduleStartDate: '2026-01-01',
        scheduleStatus: 'Complete',
        snapshot: {
          outstandingBalance: 480000,
          scheduledPayment: 2200,
          totalScheduledInterest: 150000,
          totalInterestPaid: 10000,
          payoffDate: '2056-01-01',
          lastOccurrenceDate: '2026-10-01',
          nextPayment: null,
          payments: [],
          futureSchedule: [],
        },
      }

      const accountActions = createLedgerAccountActions({
        accounts: [],
        guardSensitive: () => true,
        enqueue,
        mutateQueue,
        snapshotForUndo: vi.fn(),
        setConfirmModalData: vi.fn(),
        showToast,
        isServerAwakeRef,
      })

      const loanActions = createLoanActions({
        loans: [sampleLoan],
        recurringPayments: [] as RecurringPayment[],
        guardSensitive: () => true,
        enqueue,
        mutateQueue,
        snapshotForUndo: vi.fn(),
        setConfirmModalData: vi.fn(),
        showToast,
        isServerAwakeRef,
      })

      // 1. Test reconcile accounts pre-wake
      accountActions.handleReconcileAccounts({
        bucket: 'Essentials',
        expectedBucketTotal: 5000,
        operationId: 'rec-test-1',
        targets: [],
      })

      expect(queue).toHaveLength(0)
      expect(mutateQueue).not.toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith(
        'Account reconciliation requires a live connection to verify current balances.',
        'Live connection required',
        'warning',
      )

      // 2. Test advance repayment pre-wake
      await loanActions.handleAdvanceRepayment('adversarial-loan-1', 3)
      expect(queue).toHaveLength(0)
      expect(mutateQueue).not.toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith(
        'Loan repayment actions require a live connection to verify current amortization.',
        'Live connection required',
        'warning',
      )

      // 3. Test full settlement pre-wake
      await loanActions.handleFullSettlement('adversarial-loan-1', 480000)
      expect(queue).toHaveLength(0)
      expect(mutateQueue).not.toHaveBeenCalled()

      // 4. Concurrency flood challenge: Fire 60 concurrent attempts while server is asleep
      const floodPromises: Promise<unknown>[] = []
      for (let i = 0; i < 20; i++) {
        floodPromises.push(Promise.resolve(accountActions.handleReconcileAccounts({
          bucket: 'Essentials',
          expectedBucketTotal: i * 100,
          operationId: `flood-rec-${i}`,
          targets: [],
        })))
        floodPromises.push(loanActions.handleAdvanceRepayment('adversarial-loan-1', 1))
        floodPromises.push(loanActions.handleFullSettlement('adversarial-loan-1', 480000))
      }
      await Promise.all(floodPromises)

      // Verify zero operations slipped through into outbox
      expect(queue).toHaveLength(0)
      expect(mutateQueue).not.toHaveBeenCalled()

      // 5. Wake up server: operations must now proceed cleanly
      isServerAwakeRef.current = true

      accountActions.handleReconcileAccounts({
        bucket: 'Essentials',
        expectedBucketTotal: 5000,
        operationId: 'rec-awake-1',
        targets: [],
      })
      expect(queue).toHaveLength(1)
      expect(queue[0].entity).toBe('ledgerAccountReconcile')

      await loanActions.handleAdvanceRepayment('adversarial-loan-1', 1)
      expect(queue).toHaveLength(2)
      expect(queue[1].type).toBe('advanceRepayment')

      await loanActions.handleFullSettlement('adversarial-loan-1', 480000)
      expect(queue).toHaveLength(3)
      expect(queue[2].type).toBe('fullSettlement')

      // 6. Server goes offline again: operations immediately re-gate
      isServerAwakeRef.current = false
      accountActions.handleReconcileAccounts({
        bucket: 'Essentials',
        expectedBucketTotal: 9999,
        operationId: 'rec-offline-again',
        targets: [],
      })
      expect(queue).toHaveLength(3) // Unchanged!
    })
  })

  describe('Adversarial Cold Boot Empty Cache Challenge', () => {
    it('handles 0 accounts and 0 categories gracefully on cold boot without runtime exceptions', () => {
      const ref = createRef<TransactionFormSheetRef>()
      const onAddTransaction = vi.fn()

      render(
        <TransactionFormSheet
          ref={ref}
          hideSensitive={true}
          sensitivePreferenceStatus="pending"
          currency="USD"
          accounts={[]}
          accountsLoading={false}
          categories={[]}
          selectedMonth="11"
          selectedYear={2026}
          autocompleteSuggestions={[]}
          transactions={[]}
          essentialsAlloc={50}
          growthAlloc={20}
          stabilityAlloc={20}
          rewardsAlloc={10}
          cycleDay={1}
          stabilityBalance={0}
          stabilityTarget={0}
          stabilityOverflowRedirect="Essentials"
          onAddTransaction={onAddTransaction}
        />
      )

      // Open fresh form with empty cache
      expect(() => {
        act(() => {
          ref.current?.openFresh()
        })
      }).not.toThrow()

      // Select Essentials bucket under "From bucket" to trigger bucket account check
      const essentialsBucketBtn = screen.getByRole('radio', { name: /^Essentials$/i })
      fireEvent.click(essentialsBucketBtn)

      // Empty account helper text is rendered cleanly
      expect(screen.getByText(/No Essentials account yet/i)).toBeTruthy()

      // Type amount and description
      const descInput = screen.getByPlaceholderText(/Grocery Store/i)
      fireEvent.change(descInput, { target: { value: 'Cold boot test' } })

      const amountInput = screen.getByLabelText(/Amount/i)
      fireEvent.change(amountInput, { target: { value: '10.00' } })

      // Switching transaction types does not throw:
      const inflowTab = screen.getByRole('radio', { name: /^Inflow$/i })
      expect(() => {
        fireEvent.click(inflowTab)
      }).not.toThrow()

      const transferTab = screen.getByRole('radio', { name: /^Transfer$/i })
      expect(() => {
        fireEvent.click(transferTab)
      }).not.toThrow()

      const outflowTab = screen.getByRole('radio', { name: /^Outflow$/i })
      expect(() => {
        fireEvent.click(outflowTab)
      }).not.toThrow()

      // Attempting to submit with empty account/category:
      const submitBtn = screen.getByRole('button', { name: /Add Transaction/i })
      expect(submitBtn.hasAttribute('disabled')).toBe(false)

      // Form submission triggers validation errors cleanly without unhandled exception:
      expect(() => {
        fireEvent.click(submitBtn)
      }).not.toThrow()

      // Verify validation errors are shown gracefully
      expect(onAddTransaction).not.toHaveBeenCalled()
    })

    it('disables save button and displays loading status when accounts are still loading (accounts = undefined)', () => {
      const ref = createRef<TransactionFormSheetRef>()

      render(
        <TransactionFormSheet
          ref={ref}
          hideSensitive={true}
          sensitivePreferenceStatus="pending"
          currency="USD"
          accounts={undefined}
          accountsLoading={true}
          categories={[]}
          selectedMonth="11"
          selectedYear={2026}
          autocompleteSuggestions={[]}
          transactions={[]}
          essentialsAlloc={50}
          growthAlloc={20}
          stabilityAlloc={20}
          rewardsAlloc={10}
          cycleDay={1}
          stabilityBalance={0}
          stabilityTarget={0}
          stabilityOverflowRedirect="Essentials"
          onAddTransaction={vi.fn()}
        />
      )

      act(() => {
        ref.current?.openFresh()
      })

      const submitBtn = screen.getByRole('button', { name: /Add Transaction/i })
      expect(submitBtn.hasAttribute('disabled')).toBe(true)
      expect(submitBtn.getAttribute('title')).toBe('Loading accounts…')
    })

    it('renders empty state in DetectedTransactionsSheet when candidate list is empty', () => {
      render(
        <DetectedTransactionsSheet
          isOpen={true}
          onClose={vi.fn()}
          candidates={[]}
          busy={false}
          formOpen={false}
          hideSensitive={true}
          onReview={vi.fn()}
          onDiscard={vi.fn().mockResolvedValue(true)}
        />
      )

      expect(screen.getByText('You’re all caught up')).toBeTruthy()
      expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    })
  })
})
