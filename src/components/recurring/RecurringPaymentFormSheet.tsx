import React from 'react'
import { motion } from 'framer-motion'
import { Edit, Plus } from 'lucide-react'
import type { RecurringFrequency, RecurringPayment, TransactionCategory } from '../../types'
import { getCurrencySymbol } from '../../lib/utils'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { BottomSheet } from '../ui/BottomSheet'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import type { RecurringLedgerCategory } from './useRecurringPaymentsView'

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
  onSubmit: (e: React.FormEvent) => void
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
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Subscription Name</label>
          <input
            ref={firstInputRef}
            type="text"
            placeholder="e.g. Netflix, Spotify"
            value={name}
            onChange={onNameChange}
            className={`w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
              errors.name
                ? 'border-destructive focus:ring-destructive'
                : 'border-border focus:ring-blue-500'
            }`}
          />
          {errors.name && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Billing Amount ({getCurrencySymbol(currency)})</label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 z-10 text-xs font-semibold text-muted-foreground pointer-events-none select-none">
              {getCurrencySymbol(currency)}
            </span>
            <SmartAmountInput
              type="text"
              placeholder="0.00"
              value={amount}
              onChange={onAmountChange}
              className={`w-full pr-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                getCurrencySymbol(currency).length > 2 ? 'pl-12' : getCurrencySymbol(currency).length > 1 ? 'pl-10' : 'pl-8'
              } ${
                errors.amount
                  ? 'border-destructive focus:ring-destructive'
                  : 'border-border focus:ring-blue-500'
              }`}
            />
          </div>
          {errors.amount && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {errors.amount}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Budget Category</label>
          <CustomSelect
            ariaLabel="Budget category"
            value={category || (categories[0]?.name || '')}
            onChange={val => onCategoryChange(val)}
            options={categories.map(c => ({ value: c.name, label: c.name }))}
            className="w-full"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Frequency</label>
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
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Recurring Start Date</label>
          <DatePicker
            value={startDateInput}
            onChange={onStartDateChange}
            error={!!errors.startDate}
            className="w-full"
          />
          {errors.startDate && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {errors.startDate}
            </p>
          )}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Your start date sets the recurring payment date — monthly bills recur on this day each cycle; annual bills recur on this date each year.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Ledger Category</label>
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
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">End Billing Date (Optional)</label>
          <DatePicker
            value={endDateInput}
            onChange={onEndDateChange}
            placeholder="No end date"
            className="w-full"
          />
        </div>

        <div className="sm:col-span-2 flex gap-2 justify-end border-t border-border/30 pt-4 mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition cursor-pointer"
          >
            {editingPayment ? 'Save Changes' : 'Add Subscription'}
          </motion.button>
        </div>
      </form>
    </BottomSheet>
  )
}
