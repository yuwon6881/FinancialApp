import { forwardRef, useImperativeHandle } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { ReceiptScanPicker } from './transaction-form/ReceiptScanPicker'
import { ReceiptScanStatus } from './transaction-form/ReceiptScanStatus'
import { TransactionTypeFields } from './transaction-form/TransactionTypeFields'
import { TransactionFormFields } from './transaction-form/TransactionFormFields'
import { useTransactionForm } from './transaction-form/useTransactionForm'
import type { TransactionType } from './transaction-form/transactionFormReducer'
import type { Transaction, TransactionCategory, AutocompleteSuggestion } from '../../types'

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
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onStartEditPending?: (id: string | null) => void
  onAddFormOpenChange?: (open: boolean) => void
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  receiptScanDraft?: any
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  activeScanJobIds?: string[]
  failedScanJob?: any
  aiDraft?: any
  aiEditDraft?: any
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onShowAlert?: (message: string, title?: string) => void
}

export interface TransactionFormSheetRef {
  openFresh: () => void
  handleStartEdit: (t: Transaction) => void
  handleCloseForm: () => void
}

export const TransactionFormSheet = forwardRef<TransactionFormSheetRef, TransactionFormSheetProps>((props, ref) => {
  const form = useTransactionForm(props)

  useImperativeHandle(ref, () => ({
    openFresh: form.openFresh,
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
      <form onSubmit={form.handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReceiptScanPicker
            isScanning={form.scanner.isScanning}
            showScanPicker={form.scanner.showScanPicker}
            setShowScanPicker={form.scanner.setShowScanPicker}
            scanFileInputRef={form.scanner.scanFileInputRef}
            scanGalleryInputRef={form.scanner.scanGalleryInputRef}
            handleScanReceipt={form.scanner.handleScanReceipt}
            setScanError={form.scanner.setScanError}
          />

          <ReceiptScanStatus
            showScanBanner={form.scanner.showScanBanner}
            setShowScanBanner={form.scanner.setShowScanBanner}
            scanError={form.scanner.scanError}
            setScanError={form.scanner.setScanError}
          />

          <TransactionTypeFields
            txType={form.state.transactionType}
            onChangeTxType={(type: TransactionType) => form.dispatch({ type: 'SET_FIELD', field: 'transactionType', value: type })}
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
            filteredSuggestions={form.filteredSuggestions}
            quickSuggestionEntries={form.quickSuggestionEntries}
            suggestions={form.suggestions}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={form.handleCloseForm}
            className="flex-1 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted text-muted-foreground transition text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10 transition text-xs font-semibold cursor-pointer"
          >
            {form.state.mode === 'edit' ? 'Save Changes' : 'Add Transaction'}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
})

TransactionFormSheet.displayName = 'TransactionFormSheet'
export default TransactionFormSheet
