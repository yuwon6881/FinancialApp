import React from 'react'
import type { LedgerAccount } from '../../../types'
import { FormField } from '../../ui/FormField'
import { CustomSelect } from '../../ui/CustomSelect'
import type { TransactionFormState, TransferBucket } from './transactionFormReducer'

export interface IncomeSplitAccountsCardProps {
  state: TransactionFormState
  accounts: LedgerAccount[]
  errors: Record<string, string>
  onSetSplitAccountId?: (bucket: TransferBucket, accountId: string) => void
}

export const IncomeSplitAccountsCard: React.FC<IncomeSplitAccountsCardProps> = ({
  state,
  accounts,
  errors,
  onSetSplitAccountId,
}) => {
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-3.5 sm:col-span-2">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-foreground">Receiving accounts per bucket</p>
        <p className="text-[11px] text-muted-foreground">
          Choose which account receives each bucket&apos;s share.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {(['Essentials', 'Growth', 'Stability', 'Rewards'] as const).map(bucket => {
          const bucketAccounts = accounts.filter(account => account.bucket === bucket && !account.isArchived)
          const currentSelectedId = state.splitAccountIds?.[bucket] || ''
          const options = [
            { value: '', label: `Choose ${bucket} account` },
            ...bucketAccounts.map(account => ({ value: account.id, label: account.name })),
          ]

          return (
            <FormField key={bucket} label={`${bucket} account`} required error={!currentSelectedId ? errors[`splitAccountIds.${bucket}`] : undefined}>
              <CustomSelect
                ariaLabel={`${bucket} receiving account`}
                value={currentSelectedId}
                onChange={value => onSetSplitAccountId?.(bucket, value)}
                options={options}
                className="w-full"
              />
            </FormField>
          )
        })}
      </div>
    </div>
  )
}
