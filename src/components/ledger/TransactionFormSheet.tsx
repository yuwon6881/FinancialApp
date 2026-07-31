import { forwardRef, useImperativeHandle } from 'react'
import { useAppContext } from '../../contexts/AppContext'
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
  Transaction,
  TransactionCategory,
  AutocompleteSuggestion,
  TransactionDocumentChanges,
} from '../../types'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../../lib/useReceiptSplitPolling'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'

export interface TransactionFormSheetProps {
  categories: TransactionCategory[]
  currency: string
  hideSensitive: boolean
  autocompleteSuggestions: AutocompleteSuggestion[]
  transactions: Transaction[]
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  stabilityBalance: number
  stabilityTarget: number
  stabilityOverflowRedirect: string
  onAddTransaction: (
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<string | void> | string | void
  onUpdateTransaction?: (
    id: string,
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<void> | void
  onStartEditPending?: (id: string | null) => void
  onAddFormOpenChange?: (open: boolean) => void
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  receiptScanDraft?: any
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  activeScanJobIds?: string[]
  failedScanJob?: any
  aiEditDraft?: any
  onAiEditDraftConsumed?: () => void
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onShowAlert?: (message: string, title?: string) => void
  receiptSplitDraft?: ReceiptSplitDraft | null
  failedReceiptSplitJob?: ReceiptSplitFailure | null
  onReceiptSplitStarted?: (scanId: string) => void
}

export interface TransactionPrefillDraft {
  description: string
  amount: number
  date?: string | null
  category?: string
  ledgerCategory?: string
  txType: 'inflow' | 'outflow'
}

export interface TransactionFormSheetRef {
  openFresh: () => void
  openWithDraft: (draft: TransactionPrefillDraft) => void
  handleStartEdit: (t: Transaction) => void
  handleCloseForm: () => void
}

export const TransactionFormSheet = forwardRef<TransactionFormSheetRef, TransactionFormSheetProps>((props, ref) => {
  const app = useAppContext()
  const form = useTransactionForm(props)
  const splitScan = useReceiptSplitScan({
    receiptSplitDraft: props.receiptSplitDraft,
    failedReceiptSplitJob: props.failedReceiptSplitJob,
    onReceiptSplitStarted: props.onReceiptSplitStarted,
    onError: form.scanner.setScanError,
  })

  useImperativeHandle(ref, () => ({
    openFresh: form.openFresh,
    openWithDraft: form.openWithDraft,
    handleStartEdit: form.handleStartEdit,
    handleCloseForm: form.handleCloseForm,
  }))

  const title = form.state.mode === 'edit' ? 'Edit Transaction' : 'Add Transaction'

  return (
    <BottomSheet
      isOpen={form.state.showAddForm}
      onClose={form.handleCloseForm}
      title={title}
    >
      <form noValidate onSubmit={form.handleSubmit} className="space-y-5">
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
            txType={form.state.transactionType}
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
            errors={form.state.errors}
            onSetField={(field: any, val: any) => form.dispatch({ type: 'SET_FIELD', field, value: val })}
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
          />

          <div className="sm:col-span-2">
            <TransactionDocumentsField
              ref={form.documentsFieldRef}
              existingDocuments={form.existingDocuments}
              defaultTaxYear={Number(form.state.date.slice(0, 4)) || new Date().getFullYear()}
              transactionAmount={form.state.amount}
              currency={props.currency}
              disabled={app?.isOffline || !navigator.onLine}
            />
          </div>
        </div>

        <ModalActions className="pt-2">
          <Button
            variant="outline"
            type="button"
            onClick={form.handleCloseForm}
            className="rounded-xl py-2.5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-xl py-2.5 shadow-lg shadow-primary/10"
          >
            {form.state.mode === 'edit' ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
  )
})

TransactionFormSheet.displayName = 'TransactionFormSheet'
