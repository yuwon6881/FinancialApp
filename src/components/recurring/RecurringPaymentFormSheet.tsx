import { Input } from '../ui/Input'
import React from 'react'
import { Edit, Plus } from 'lucide-react'
import type { RecurringFrequency, RecurringPayment, TransactionCategory } from '../../types'
import { RECURRING_PAYMENT_MODE_LABELS } from '../../lib/recurringPayments'
import { getCurrencySymbol } from '../../lib/utils'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { BottomSheet } from '../ui/BottomSheet'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import type { RecurringLedgerCategory, RecurringPaymentModeSelection } from './useRecurringPaymentsView'
import { FormField } from '../ui/FormField'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'

interface RecurringPaymentFormSheetProps {
  isOpen: boolean
  editingPayment: RecurringPayment | null
  errors: Record<string, string>
  name: string
  amount: string
  category: string
  ledgerCategory: RecurringLedgerCategory
  frequency: RecurringFrequency
  startDateInput: string
  endDateInput: string
  paymentMode: RecurringPaymentModeSelection
  categories: TransactionCategory[]
  currency: string
  firstInputRef: React.RefObject<HTMLInputElement | null>
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCategoryChange: (value: string) => void
  onLedgerCategoryChange: (value: RecurringLedgerCategory) => void
  onFrequencyChange: (value: RecurringFrequency) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onPaymentModeChange: (value: RecurringPaymentModeSelection) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

// Add / Edit Subscription Modal (bottom sheet on mobile)
export const RecurringPaymentFormSheet: React.FC<RecurringPaymentFormSheetProps> = ({
  isOpen,
  editingPayment,
  errors,
  name,
  amount,
  category,
  ledgerCategory,
  frequency,
  startDateInput,
  endDateInput,
  paymentMode,
  categories,
  currency,
  firstInputRef,
  onNameChange,
  onAmountChange,
  onCategoryChange,
  onLedgerCategoryChange,
  onFrequencyChange,
  onStartDateChange,
  onEndDateChange,
  onPaymentModeChange,
  onSubmit,
  onCancel,
}) => {
  if (!isOpen) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onCancel}
      maxWidthClassName="max-w-xl"
      title={
        <span className="flex items-center gap-2">
          {editingPayment ? <Edit className="size-4 text-blue-500" /> : <Plus className="size-4 text-blue-500" />}
          {editingPayment ? 'Edit Subscription' : 'Add New Recurring Payment'}
        </span>
      }
    >
      <form noValidate onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {editingPayment && (
          <p className="sm:col-span-2 rounded-xl border border-blue-500/15 bg-blue-500/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Changes apply to unpaid and future bills. Paid bills keep the details recorded in the ledger.
          </p>
        )}
        <FormField label="Subscription name" required error={errors.name}>
          <Input
            ref={firstInputRef}
            type="text"
            placeholder="e.g. Netflix, Spotify"
            value={name}
            onChange={onNameChange}
          />
        </FormField>

        <FormField label={`Billing amount (${getCurrencySymbol(currency)})`} required error={errors.amount}>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 z-10 text-xs font-semibold text-muted-foreground pointer-events-none select-none">
              {getCurrencySymbol(currency)}
            </span>
            <SmartAmountInput
              type="text"
              placeholder="0.00"
              value={amount}
              onChange={onAmountChange}
              className={`w-full pr-3.5 ${
                getCurrencySymbol(currency).length > 2 ? 'pl-12' : getCurrencySymbol(currency).length > 1 ? 'pl-10' : 'pl-8'
              }`}
            />
          </div>
        </FormField>

        <FormField label="Budget category">
          <CustomSelect
            ariaLabel="Budget category"
            value={category || (categories.find(c => !c.type || c.type === 'both' || c.type === 'outflow')?.name || categories[0]?.name || '')}
            onChange={val => onCategoryChange(val)}
            options={categories
              .filter(c => !c.isPendingDelete && (!c.type || c.type === 'both' || c.type === 'outflow'))
              .map(c => ({ value: c.name, label: c.name }))}
            className="w-full"
          />
        </FormField>

        <FormField label="Payment frequency">
          <CustomSelect
            ariaLabel="Payment frequency"
            value={frequency}
            onChange={onFrequencyChange}
            options={[
              { value: 'Monthly', label: 'Monthly' },
              { value: 'Annually', label: 'Annually' }
            ]}
            className="w-full"
          />
        </FormField>

        {/* The explanation is a FormField hint rather than an InfoHint: the label is this
            control's accessible name, so a popover button inside it would be read out as part
            of the name, and a hint is wired to aria-describedby instead. */}
        <FormField
          label="How it's paid"
          required
          error={errors.paymentMode}
          hint="Auto deduct means the money leaves your account on its own each cycle. Manual payment means you send it yourself — only these can be paid early."
        >
          <CustomSelect
            ariaLabel="How it's paid"
            value={paymentMode}
            onChange={onPaymentModeChange}
            invalid={Boolean(errors.paymentMode)}
            options={[
              // The empty option is what gives the untouched trigger its prompt; CustomSelect
              // refuses to select a disabled option, so it can never be submitted.
              { value: '', label: 'Choose how it’s paid', disabled: true },
              { value: 'AutoDeduct', label: RECURRING_PAYMENT_MODE_LABELS.AutoDeduct },
              { value: 'Manual', label: RECURRING_PAYMENT_MODE_LABELS.Manual }
            ]}
            className="w-full"
          />
        </FormField>

        <FormField label="Recurring start date" required error={errors.startDate}>
          <DatePicker
            value={startDateInput}
            onChange={onStartDateChange}
            className="w-full"
          />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Your start date sets the recurring payment date — monthly bills recur on this day each cycle; annual bills recur on this date each year.
          </p>
        </FormField>

        <FormField label="Ledger category">
          <CustomSelect
            ariaLabel="Ledger category"
            value={ledgerCategory}
            onChange={val => onLedgerCategoryChange(val)}
            options={[
              { value: 'Essentials', label: 'Essentials' },
              { value: 'Growth', label: 'Growth' },
              { value: 'Stability', label: 'Stability' },
              { value: 'Rewards', label: 'Rewards' }
            ]}
            className="w-full"
          />
        </FormField>

        <FormField label="End billing date" hint="Optional">
          <DatePicker
            value={endDateInput}
            onChange={onEndDateChange}
            placeholder="No end date"
            className="w-full"
          />
        </FormField>

        <ModalActions className="sm:col-span-2 border-t border-border/30 pt-4 mt-1">
          <Button
            variant="outline"
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-xl px-5 py-2.5 shadow-lg shadow-primary/25 hover:shadow-primary/40"
          >
            {editingPayment ? 'Save Changes' : 'Add Subscription'}
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
  )
}
