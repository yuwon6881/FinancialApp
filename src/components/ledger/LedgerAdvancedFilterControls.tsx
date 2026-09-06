import React from 'react'
import { CalendarDays, Banknote, SlidersHorizontal } from 'lucide-react'
import { FormField } from '../ui/FormField'
import { DatePicker } from '../ui/DatePicker'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import type { LedgerAccount } from '../../types'
import { CustomSelect } from '../ui/CustomSelect'
import {
  type TransactionLinkFilter,
  type TransactionTypeFilterOption,
  type TxTypeFilter,
  type StabilityReloadFilter,
  parseTxTypes,
} from '../../lib/transactionFilters'
import { isUnusableAmountFilter } from './view/ledgerViewTypes'

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
  /** A typed bound the predicate cannot use, so it would otherwise filter nothing in silence. */
  hasUnusableAmount?: boolean
  txType: TxTypeFilter
  onTxTypeChange: (value: TransactionTypeFilterOption | null) => void
  recurringFilter: TransactionLinkFilter
  onRecurringFilterChange: (value: TransactionLinkFilter) => void
  wishlistFilter: TransactionLinkFilter
  onWishlistFilterChange: (value: TransactionLinkFilter) => void
  reloadFilter?: StabilityReloadFilter
  onReloadFilterChange?: (value: StabilityReloadFilter) => void
  accounts: LedgerAccount[]
  accountIds: string[]
  onAccountToggle: (accountId: string) => void
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
  hasUnusableAmount = false,
  txType,
  onTxTypeChange,
  recurringFilter,
  onRecurringFilterChange,
  wishlistFilter,
  onWishlistFilterChange,
  reloadFilter,
  onReloadFilterChange,
  accounts,
  accountIds,
  onAccountToggle,
}) => {
  const activeTxTypes = parseTxTypes(txType)

  return (
    <div className="space-y-4 border-t border-border/40 pt-4 lg:border-t-0 lg:pt-0">
      {/* Date Range */}
      <div className="space-y-1.5">
        <span className="text-eyebrow uppercase flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="size-3 text-accent-ink" /> Date range
        </span>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="From" labelClassName="text-xs text-muted-foreground">
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
          <FormField label="To" labelClassName="text-xs text-muted-foreground">
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
        {hasInvalidDateRange && <p role="alert" className="text-xs font-semibold text-destructive">Start date must be before the end date.</p>}
      </div>

      {/* Amount Range */}
      <div className="space-y-1.5">
        <span className="text-eyebrow uppercase flex items-center gap-1.5 text-muted-foreground">
          <Banknote className="size-3 text-accent-ink" /> Amount range
        </span>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Minimum" labelClassName="text-xs text-muted-foreground">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={minAmount}
              onChange={event => onMinAmountChange(event.target.value)}
              invalid={hasInvalidAmountRange || isUnusableAmountFilter(minAmount)}
              controlSize="sm"
            />
          </FormField>
          <FormField label="Maximum" labelClassName="text-xs text-muted-foreground">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Any"
              value={maxAmount}
              onChange={event => onMaxAmountChange(event.target.value)}
              invalid={hasInvalidAmountRange || isUnusableAmountFilter(maxAmount)}
              controlSize="sm"
            />
          </FormField>
        </div>
        <p className="text-xs text-muted-foreground">Uses absolute amount for both inflows and outflows.</p>
        {hasInvalidAmountRange && <p role="alert" className="text-xs font-semibold text-destructive">Minimum amount cannot exceed maximum amount.</p>}
        {hasUnusableAmount && <p role="alert" className="text-xs font-semibold text-destructive">Enter a positive amount. A negative bound cannot match anything and is ignored.</p>}
      </div>

      {/* Transaction Type Segmented Control */}
      <div className="space-y-1.5">
        <span className="text-eyebrow uppercase text-muted-foreground block">
          Transaction type
        </span>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
          {([
            [null, 'All'],
            ['inflow', 'Inflow'],
            ['outflow', 'Outflow'],
            ['transfer', 'Transfer'],
          ] as const).map(([value, label]) => {
            const isSelected = value === null ? activeTxTypes.length === 0 : activeTxTypes.includes(value)
            return (
              <Button
                variant="tertiary"
                type="button"
                key={label}
                onClick={() => onTxTypeChange(value)}
                className={`rounded-lg py-1.5 text-center text-xs font-semibold transition cursor-pointer select-none ${
                  isSelected
                    ? 'bg-card hover:bg-card text-blue-500 shadow-xs border border-border/80 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Grouped Property Filters */}
      <div className="space-y-1.5">
        <span className="text-eyebrow uppercase flex items-center gap-1.5 text-muted-foreground">
          <SlidersHorizontal className="size-3 text-accent-ink" /> Filters & Rules
        </span>
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-2.5">
          {onReloadFilterChange && (
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-xs font-medium text-foreground">Emergency reload</span>
              <CustomSelect<StabilityReloadFilter>
                ariaLabel="Emergency fund reload filter"
                value={reloadFilter ?? 'all'}
                onChange={onReloadFilterChange}
                options={[
                  { value: 'all', label: 'Include all' },
                  { value: 'put-back', label: 'Marked as put back' },
                  { value: 'needs-put-back', label: 'Needs put back' },
                  { value: 'outstanding', label: 'Not started' },
                  { value: 'partly-repaid', label: 'Partly put back' },
                  { value: 'complete', label: 'Put back complete' },
                  { value: 'not-required', label: 'Spent for good' },
                ]}
                align="right"
                controlSize="sm"
                className="w-40 shrink-0"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
            <span className="min-w-0 text-xs font-medium text-foreground">Recurring bills</span>
            <CustomSelect<TransactionLinkFilter>
              ariaLabel="Recurring transactions filter"
              value={recurringFilter}
              onChange={onRecurringFilterChange}
              options={[
                { value: 'all', label: 'Include all' },
                { value: 'exclude', label: 'Exclude recurring' },
                { value: 'only', label: 'Recurring only' },
              ]}
              align="right"
              controlSize="sm"
              className="w-40 shrink-0"
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
            <span className="min-w-0 text-xs font-medium text-foreground">Wishlist rewards</span>
            <CustomSelect<TransactionLinkFilter>
              ariaLabel="Reward purchases filter"
              value={wishlistFilter}
              onChange={onWishlistFilterChange}
              options={[
                { value: 'all', label: 'Include all' },
                { value: 'exclude', label: 'Exclude rewards' },
                { value: 'only', label: 'Rewards only' },
              ]}
              align="right"
              controlSize="sm"
              className="w-40 shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Accounts List */}
      {accounts.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="text-eyebrow uppercase text-muted-foreground">Accounts</legend>
          <div className="max-h-44 space-y-2.5 overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-2.5">
            {(['Essentials', 'Growth', 'Stability', 'Rewards'] as const).map(bucket => {
              const bucketAccounts = accounts
                .filter(account => account.bucket === bucket && !account.isPendingDelete)
                .sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name))
              if (bucketAccounts.length === 0) return null
              return (
                <div key={bucket} className="space-y-1">
                  <span className="block px-1 text-eyebrow uppercase text-muted-foreground">{bucket}</span>
                  <div className="space-y-0.5">
                    {bucketAccounts.map(account => (
                      <label key={account.id} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted/40 transition-colors">
                        <Checkbox
                          checked={accountIds.includes(account.id)}
                          onChange={() => onAccountToggle(account.id)}
                          aria-label={`Filter by ${account.name}${account.isArchived ? ', closed account' : ''}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{account.name}</span>
                        {account.isArchived && <span className="shrink-0 text-xs text-muted-foreground bg-muted/60 px-1 rounded">Closed</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>
      )}
    </div>
  )
}
