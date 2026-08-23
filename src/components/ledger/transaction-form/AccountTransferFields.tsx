import React from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { FormField } from '../../ui/FormField'
import { Button } from '../../ui/Button'
import { CustomSelect } from '../../ui/CustomSelect'
import { DatePicker } from '../../ui/DatePicker'
import type { TransactionFormState, TransferBucket } from './transactionFormReducer'

export interface AccountTransferFieldsProps {
  state: TransactionFormState
  isAccountMove: boolean
  errors: Record<string, string>
  accountMoveOptions: Array<{ value: string; label: string; disabled?: boolean }>
  accountOptions: Array<{ value: string; label: string; disabled?: boolean }>
  transferTargetOptions: Array<{ value: string; label: string; disabled?: boolean }>
  onSetField: (field: keyof TransactionFormState, value: any) => void
  onSwapTransfer?: () => void
}

export const AccountTransferFields: React.FC<AccountTransferFieldsProps> = ({
  state,
  isAccountMove,
  errors,
  accountMoveOptions,
  accountOptions,
  transferTargetOptions,
  onSetField,
  onSwapTransfer,
}) => {
  if (isAccountMove) {
    return (
      <>
        <div className="sm:col-span-2 flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-muted-foreground">Account Transfer</span>
          <Button
            variant="outline"
            size="xs"
            type="button"
            onClick={() => {
              const temp = state.accountId
              onSetField('accountId', state.counterAccountId)
              onSetField('counterAccountId', temp)
            }}
            title="Swap source and destination accounts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/50 cursor-pointer transition"
          >
            <ArrowLeftRight className="size-3" />
            Swap Accounts
          </Button>
        </div>

        <FormField
          label="From account"
          required
          error={errors.accountId}
        >
          <CustomSelect
            value={state.accountId ?? ''}
            onChange={value => onSetField('accountId', value || null)}
            options={accountMoveOptions.map(option => ({
              ...option,
              disabled: option.disabled || option.value === state.counterAccountId,
            }))}
            className="w-full"
          />
        </FormField>

        <FormField
          label="To account"
          required
          error={errors.counterAccountId}
        >
          <CustomSelect
            value={state.counterAccountId ?? ''}
            onChange={value => onSetField('counterAccountId', value || null)}
            options={accountMoveOptions.map(option => ({
              ...option,
              disabled: option.disabled || option.value === state.accountId,
            }))}
            className="w-full"
          />
        </FormField>

        <FormField label="Posting date" className="sm:col-span-2" required error={errors.date}>
          <DatePicker
            value={state.date}
            onChange={value => {
              onSetField('date', value)
            }}
            className="w-full"
          />
        </FormField>
      </>
    )
  }

  return (
    <>
      <div className="sm:col-span-2 flex items-center justify-between pt-1">
        <span className="text-xs font-semibold text-muted-foreground">Transfer Route</span>
        <Button
          variant="outline"
          size="xs"
          type="button"
          onClick={onSwapTransfer}
          title="Swap transfer source and destination"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/50 cursor-pointer transition"
        >
          <ArrowLeftRight className="size-3 text-teal-500" />
          Swap Direction
        </Button>
      </div>

      <FormField label="Source category (from)">
        <CustomSelect
          ariaLabel="Transfer source category"
          value={state.transferSource}
          onChange={val => onSetField('transferSource', val as TransferBucket)}
          options={[
            { value: 'Essentials', label: 'Essentials' },
            { value: 'Growth', label: 'Growth' },
            { value: 'Stability', label: 'Stability' },
            { value: 'Rewards', label: 'Rewards' }
          ]}
          className="w-full"
        />
      </FormField>

      <FormField label="Target category (to)" required error={errors.transferTarget}>
        <CustomSelect
          ariaLabel="Transfer target category"
          value={state.transferTarget}
          onChange={val => onSetField('transferTarget', val as TransferBucket)}
          options={[
            { value: 'Essentials', label: 'Essentials' },
            { value: 'Growth', label: 'Growth' },
            { value: 'Stability', label: 'Stability' },
            { value: 'Rewards', label: 'Rewards' }
          ]}
          className="w-full"
        />
      </FormField>

      <FormField label="Source account" required error={errors.accountId}>
        <CustomSelect
          value={state.accountId ?? ''}
          onChange={value => onSetField('accountId', value || null)}
          options={accountOptions.map(option => ({
            ...option,
            disabled: option.disabled || (option.value !== '' && option.value === state.counterAccountId),
          }))}
          className="w-full"
        />
      </FormField>

      <FormField label="Destination account" required error={errors.counterAccountId}>
        <CustomSelect
          value={state.counterAccountId ?? ''}
          onChange={value => onSetField('counterAccountId', value || null)}
          options={transferTargetOptions.map(option => ({
            ...option,
            disabled: option.disabled || (option.value !== '' && option.value === state.accountId),
          }))}
          className="w-full"
        />
      </FormField>

      <FormField label="Posting date" className="sm:col-span-2" required error={errors.date}>
        <DatePicker
          value={state.date}
          onChange={value => {
            onSetField('date', value)
          }}
          className="w-full"
        />
      </FormField>
    </>
  )
}
