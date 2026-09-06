import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { useAppContext } from '../../contexts/AppContext'
import type { LedgerAddPrefill } from '../../app/useCycleNavigation'
import { BottomSheet } from '../ui/BottomSheet'
import { ReceiptScanPicker } from './transaction-form/ReceiptScanPicker'
import { ReceiptScanStatus } from './transaction-form/ReceiptScanStatus'
import { TransactionTypeFields } from './transaction-form/TransactionTypeFields'
import { TransactionFormFields } from './transaction-form/TransactionFormFields'
import { useTransactionForm } from './transaction-form/useTransactionForm'
import { TransactionDocumentsField } from './transaction-form/TransactionDocumentsField'
import { useReceiptSplitScan } from './transaction-form/useReceiptSplitScan'
import type { TransactionType } from './transaction-form/transactionFormReducer'
import type {
  ActiveRecurringPayment,
  CategorySummary,
  Transaction,
  TransactionCategory,
  AutocompleteSuggestion,
  TransactionDocumentChanges,
  LedgerAccount,
  SavingsGoal,
} from '../../types'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../../lib/useReceiptSplitPolling'
import type { ReceiptScanResult } from '../../lib/api'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'
import type { StabilityTopUpContext } from './transaction-form/useTransactionFormOptions'

const ReceiptSplitSheet = lazy(() =>
  import('./ReceiptSplitSheet').then(module => ({ default: module.ReceiptSplitSheet })))

export interface TransactionFormSheetProps {
  categories: TransactionCategory[]
  accounts?: LedgerAccount[]
  accountsLoading?: boolean
  currency: string
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  autocompleteSuggestions: AutocompleteSuggestion[]
  transactions: Transaction[]
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
  selectedMonth?: string
  selectedYear?: number
  stabilityBalance: number
  stabilityTarget: number
  stabilityOverflowRedirect: string
  /** Current-cycle balances and recovery state; eligibility follows the transaction posting date. */
  stabilityTopUpContext?: StabilityTopUpContext
  savingsGoals?: SavingsGoal[]
  activeRecurringPayments?: ActiveRecurringPayment[]
  ledgerSummaries?: CategorySummary[]
  onAddTransaction: (
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<string | void> | string | void
  onUpdateTransaction?: (
    id: string,
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<void> | void
  onUpdateDraftTransaction?: (
    id: string,
    transaction: Omit<Transaction, 'id'>,
    documentChanges: TransactionDocumentChanges,
  ) => Promise<void> | void
  onLoadDraftDocumentChanges?: (id: string) => Promise<TransactionDocumentChanges>
  onStartEditPending?: (id: string | null) => void
  onAddFormOpenChange?: (open: boolean) => void
  autoOpenAddForm?: boolean
  autoOpenTxType?: 'inflow' | 'outflow' | 'transfer' | null
  autoOpenPrefill?: LedgerAddPrefill | null
  onResetAutoOpen?: () => void
  receiptScanDraft?: { jobId: string; result: ReceiptScanResult } | null
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  activeScanJobIds?: string[]
  failedScanJob?: { jobId: string; errorMessage: string } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  onAiEditDraftConsumed?: () => void
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onShowAlert?: (message: string, title?: string) => void
  onOutsideCycleSave?: (date: string) => void
  receiptSplitDraft?: ReceiptSplitDraft | null
  failedReceiptSplitJob?: ReceiptSplitFailure | null
  onReceiptSplitStarted?: (scanId: string) => void
  onReceiptSplitCleared?: (scanId: string) => void | Promise<void>
  /** Hands a still-running split scan back to the completion toast when this form goes away. */
  onReceiptSplitReviewReleased?: (scanId: string) => void
  autoOpenReceiptSplit?: boolean
  onResetAutoOpenReceiptSplit?: () => void
  onReceiptSplitOpenChange?: (open: boolean) => void
}

export interface TransactionPrefillDraft {
  description: string
  amount: number
  date?: string | null
  category?: string
  ledgerCategory?: string
  txType: 'inflow' | 'outflow'
  accountId?: string | null
}

export interface TransactionFormSheetRef {
  openFresh: () => void
  openWithDraft: (draft: TransactionPrefillDraft) => void
  handleStartEdit: (t: Transaction) => void
  handleStartDraft: (t: Transaction) => Promise<void>
  handleCloseForm: () => void
}

export const TransactionFormSheet = forwardRef<TransactionFormSheetRef, TransactionFormSheetProps>((props, ref) => {
  const app = useAppContext()
  const form = useTransactionForm(props)
  const accountsLoading = props.accountsLoading ?? props.accounts === undefined
  const securityPending = props.sensitivePreferenceStatus === 'pending'
  const saveDisabled = props.hideSensitive || securityPending || accountsLoading || form.isSubmitting
  const [isReceiptSplitOpen, setIsReceiptSplitOpen] = useState(false)
  const setReceiptSplitOpen = useCallback((open: boolean) => {
    setIsReceiptSplitOpen(open)
    props.onReceiptSplitOpenChange?.(open)
  }, [props.onReceiptSplitOpenChange])
  const hideSensitive = props.hideSensitive
  const onShowAlert = props.onShowAlert
  // The scan this form is spinning on opens its editor here rather than waiting to be found: the
  // completion toast lasts seconds, and the Ledger's review banner is behind this very sheet.
  const reviewSplitDraft = useCallback(() => {
    if (hideSensitive) {
      onShowAlert?.('Reveal sensitive data to review the scanned receipt.', 'Split Receipt')
      return
    }
    setReceiptSplitOpen(true)
  }, [hideSensitive, onShowAlert, setReceiptSplitOpen])
  const splitScan = useReceiptSplitScan({
    receiptSplitDraft: props.receiptSplitDraft,
    failedReceiptSplitJob: props.failedReceiptSplitJob,
    onReceiptSplitStarted: props.onReceiptSplitStarted,
    onReviewDraft: reviewSplitDraft,
    onReleaseReview: props.onReceiptSplitReviewReleased,
    onError: form.scanner.setScanError,
  })

  useImperativeHandle(ref, () => ({
    openFresh: form.openFresh,
    openWithDraft: form.openWithDraft,
    handleStartEdit: form.handleStartEdit,
    handleStartDraft: form.handleStartDraft,
    handleCloseForm: form.handleCloseForm,
  }))

  useEffect(() => {
    if (!props.autoOpenReceiptSplit) return
    // Consuming the flag while masked used to make Review do nothing at all, with no explanation.
    reviewSplitDraft()
    props.onResetAutoOpenReceiptSplit?.()
  }, [props.autoOpenReceiptSplit, props.onResetAutoOpenReceiptSplit, reviewSplitDraft])

  useEffect(() => {
    if (props.hideSensitive) setReceiptSplitOpen(false)
  }, [props.hideSensitive, setReceiptSplitOpen])

  const title = form.state.mode === 'edit'
    ? 'Edit Transaction'
    : form.state.mode === 'draft' ? 'Edit Draft' : 'Add Transaction'

  return (
    <>
    <BottomSheet
      isOpen={form.state.showAddForm}
      onClose={form.handleCloseForm}
      title={title}
    >
      <form noValidate onSubmit={form.handleSubmit} className="space-y-5">
        {securityPending && (
          <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground" role="status">
            Finishing security check… You can fill this form in, but saving is temporarily disabled.
          </p>
        )}
        {accountsLoading && !props.hideSensitive && (
          <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground" role="status">
            Loading accounts… This form will be ready to save when account data arrives.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReceiptScanPicker
            isScanning={form.scanner.isScanning}
            showScanPicker={form.scanner.showScanPicker}
            setShowScanPicker={form.scanner.setShowScanPicker}
            scanFileInputRef={form.scanner.scanFileInputRef}
            scanGalleryInputRef={form.scanner.scanGalleryInputRef}
            handleScanReceipt={form.scanner.handleScanReceipt}
            setScanError={form.scanner.setScanError}
            handleSplitScan={splitScan.handleScan}
            isSplitScanning={splitScan.isScanning}
            showSplitPicker={splitScan.showPicker}
            setShowSplitPicker={splitScan.setShowPicker}
            splitCameraInputRef={splitScan.cameraInputRef}
            splitGalleryInputRef={splitScan.galleryInputRef}
          />

          <ReceiptScanStatus
            showScanBanner={form.scanner.showScanBanner}
            setShowScanBanner={form.scanner.setShowScanBanner}
            scanError={form.scanner.scanError}
            setScanError={form.scanner.setScanError}
          />

          <TransactionTypeFields
            txType={form.state.ledgerCategory === 'AccountMove' ? 'transfer' : form.state.transactionType}
            onChangeTxType={(type: TransactionType) => form.changeTransactionType(type)}
            disabled={form.state.mode === 'edit'}
          />

          <TransactionFormFields
            state={form.state}
            firstInputRef={form.firstInputRef}
            descriptionRef={form.descriptionRef}
            autocompletedDescriptionRef={form.autocompletedDescriptionRef}
            currency={props.currency}
            categories={props.categories}
            accounts={props.accounts}
            errors={form.state.errors}
            onSetField={(field: any, val: any) => form.dispatch({ type: 'SET_FIELD', field, value: val })}
            onSetSplitAccountId={(bucket, accountId) => form.dispatch({ type: 'SET_SPLIT_ACCOUNT', bucket, accountId })}
            onSwapTransfer={() => form.dispatch({ type: 'SWAP_TRANSFER' })}
            onSelectSuggestion={form.handleSelectSuggestion}
            onSuggestNotes={() => form.suggestions.requestNoteSuggestions(form.state.description.trim())}
            onSuggestCategory={async () => {
              await form.suggestions.requestCategorySuggestions(
                form.descriptionRef.current,
                form.autocompletedDescriptionRef.current,
              )
            }}
            filteredSuggestions={form.filteredSuggestions}
            quickSuggestionEntries={form.quickSuggestionEntries}
            suggestions={form.suggestions}
            topUpOffer={form.topUpOffer}
            topUpBuckets={form.topUpBuckets}
            stabilityTopUpError={form.stabilityTopUpError}
            bucketOutflowWarning={form.bucketOutflowWarning}
            hideSensitive={props.hideSensitive}
            stabilityAlloc={props.stabilityTopUpContext?.stabilityAlloc ?? props.stabilityAlloc}
            selectedMonth={props.selectedMonth}
            selectedYear={props.selectedYear}
            cycleDay={props.cycleDay}
          />

          {form.state.transactionType === 'outflow' && (
            <div className="sm:col-span-2">
              <TransactionDocumentsField
                key={form.documentFieldRevision}
                ref={form.documentsFieldRef}
                existingDocuments={form.existingDocuments}
                initialChanges={form.initialDocumentChanges}
                defaultTaxYear={Number(form.state.date.slice(0, 4)) || new Date().getFullYear()}
                transactionAmount={form.state.amount}
                currency={props.currency}
                disabled={app?.isOffline || !navigator.onLine}
              />
            </div>
          )}
        </div>

        <ModalActions className="pt-2">
          {form.state.errors.submit && (
            <p className="basis-full text-sm text-destructive" role="alert">{form.state.errors.submit}</p>
          )}
          <Button
            variant="secondary"
            type="button"
            onClick={form.handleCloseForm}
            className="rounded-xl py-2.5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saveDisabled}
            title={securityPending
              ? 'Finishing security check…'
              : props.hideSensitive ? 'Reveal sensitive data before saving'
                : accountsLoading ? 'Loading accounts…' : undefined}
            className="rounded-xl py-2.5 shadow-lg shadow-primary/10"
          >
            {form.isSubmitting
              ? 'Saving…'
              : form.state.mode === 'edit' ? 'Save Changes' : form.state.mode === 'draft' ? 'Save Draft' : 'Add Transaction'}
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
    {isReceiptSplitOpen && props.receiptSplitDraft && (
      <Suspense fallback={null}>
        <ReceiptSplitSheet
          isOpen
          currency={props.currency}
          draft={props.receiptSplitDraft}
          onClear={scanId => props.onReceiptSplitCleared?.(scanId)}
          onClose={() => setReceiptSplitOpen(false)}
          onUseResult={form.applyPrefill}
        />
      </Suspense>
    )}
    </>
  )
})

TransactionFormSheet.displayName = 'TransactionFormSheet'
