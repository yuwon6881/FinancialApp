import React from 'react'
import { CalendarDays, Banknote } from 'lucide-react'
import { FormField } from '../ui/FormField'
import { DatePicker } from '../ui/DatePicker'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import type { TransactionLinkFilter } from '../../lib/transactionFilters'

export interface LedgerAdvancedFilterControlsProps {
  startDate: string
  onStartDateChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
  hasInvalidDateRange: boolean
  minAmount: string
  onMinAmountChange: (value: string) => void
  maxAmount: string
  onMaxAmountChange: (value: string) => void
  hasInvalidAmountRange: boolean
  txType: 'inflow' | 'outflow' | 'transfer' | null
  onTxTypeChange: (value: 'inflow' | 'outflow' | 'transfer' | null) => void
  recurringFilter: TransactionLinkFilter
  onRecurringFilterChange: (value: TransactionLinkFilter) => void
  wishlistFilter: TransactionLinkFilter
  onWishlistFilterChange: (value: TransactionLinkFilter) => void
}

export const LedgerAdvancedFilterControls: React.FC<LedgerAdvancedFilterControlsProps> = ({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  hasInvalidDateRange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  hasInvalidAmountRange,
  txType,
  onTxTypeChange,
  recurringFilter,
  onRecurringFilterChange,
  wishlistFilter,
  onWishlistFilterChange,
}) => {
  return (
    <div className="space-y-4 border-t border-border/40 pt-4 lg:border-t-0 lg:pt-0">
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <CalendarDays className="size-3" /> Date range
        </span>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="From" labelClassName="text-[10px]">
            <DatePicker
              value={startDate}
              max={endDate || undefined}
              onChange={onStartDateChange}
              clearable
              clearAriaLabel="Clear ledger from date"
              invalid={hasInvalidDateRange}
              controlSize="sm"
              className="w-full"
              popoverClassName="ledger-filter-dropdown"
            />
          </FormField>
          <FormField label="To" labelClassName="text-[10px]">
            <DatePicker
              value={endDate}
              min={startDate || undefined}
              onChange={onEndDateChange}
              clearable
              clearAriaLabel="Clear ledger to date"
              invalid={hasInvalidDateRange}
              controlSize="sm"
              className="w-full"
              popoverClassName="ledger-filter-dropdown"
            />
          </FormField>
        </div>
        {hasInvalidDateRange && <p role="alert" className="text-[10px] font-semibold text-destructive">Start date must be before the end date.</p>}
      </div>

      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <Banknote className="size-3" /> Amount range
        </span>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Minimum" labelClassName="text-[10px]">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={minAmount}
              onChange={event => onMinAmountChange(event.target.value)}
              invalid={hasInvalidAmountRange}
              controlSize="sm"
            />
          </FormField>
          <FormField label="Maximum" labelClassName="text-[10px]">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Any"
              value={maxAmount}
              onChange={event => onMaxAmountChange(event.target.value)}
              invalid={hasInvalidAmountRange}
              controlSize="sm"
            />
          </FormField>
        </div>
        <p className="text-[9px] text-muted-foreground">Uses the absolute amount for both inflows and outflows.</p>
        {hasInvalidAmountRange && <p role="alert" className="text-[10px] font-semibold text-destructive">Minimum amount cannot exceed maximum amount.</p>}
      </div>

      <div className="space-y-2">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Transaction type</span>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            [null, 'All types'],
            ['inflow', 'Inflow'],
            ['outflow', 'Outflow'],
            ['transfer', 'Transfer'],
          ] as const).map(([value, label]) => (
            <Button variant="unstyled"
              type="button"
              key={label}
              onClick={() => onTxTypeChange(value)}
              className={`rounded-lg border px-2 py-2 text-[10px] font-semibold transition cursor-pointer ${
                txType === value
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-500'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {([
        {
          label: 'Recurring transactions',
          value: recurringFilter,
          onChange: onRecurringFilterChange,
          options: [
            { value: 'all', label: 'Include all' },
            { value: 'exclude', label: 'Exclude recurring' },
            { value: 'only', label: 'Recurring only' },
          ],
        },
        {
          label: 'Reward purchases',
          value: wishlistFilter,
          onChange: onWishlistFilterChange,
          options: [
            { value: 'all', label: 'Include all' },
            { value: 'exclude', label: 'Exclude reward purchases' },
            { value: 'only', label: 'Reward purchases only' },
          ],
        },
      ] satisfies Array<{
        label: string
        value: TransactionLinkFilter
        onChange: (value: TransactionLinkFilter) => void
        options: Array<{ value: TransactionLinkFilter; label: string }>
      }>).map(({ label, value, onChange, options }) => (
        <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
          <span className="min-w-0 text-xs font-semibold text-foreground">{label}</span>
          <CustomSelect
            ariaLabel={`${label} filter`}
            value={value}
            onChange={onChange}
            options={options}
            align="right"
            controlSize="sm"
            className="w-44 shrink-0"
          />
        </div>
      ))}
    </div>
  )
}
