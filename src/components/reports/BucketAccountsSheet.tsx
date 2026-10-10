import { Settings, Wallet } from 'lucide-react'
import type { CategorySummary } from '../../types'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { cn } from '../../lib/utils'
import { AlertBanner } from '../ui/AlertBanner'
import { Badge } from '../ui/Badge'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { SensitiveAmount } from '../ui/SensitiveAmount'

interface BucketAccountsSheetProps {
  bucket: CategorySummary | null
  onClose: () => void
  isCurrentCycle: boolean
  cycleLabel: string
  amountsMasked: boolean
  formatCurrency: (value: number) => string
  onNavigateToAccounts?: (targetIdOrBucket?: string | null) => void
}

/** The accounts that make up one bucket's balance, each a step away from its settings. */
export function BucketAccountsSheet({
  bucket,
  onClose,
  isCurrentCycle,
  cycleLabel,
  amountsMasked,
  formatCurrency,
  onNavigateToAccounts,
}: BucketAccountsSheetProps) {
  if (!bucket) return null
  const accounts = bucket.accounts ?? []
  const color = getCategoryChartColor(bucket.name)
  const accountCount = `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}`

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      description={cycleLabel}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate">{bucket.name} Account Balances</span>
        </span>
      }
      headerActions={<Badge>{(bucket.allocation * 100).toFixed(0)}% Allocation</Badge>}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {onNavigateToAccounts && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onNavigateToAccounts(bucket.name)
                onClose()
              }}
            >
              <Settings className="size-3.5" aria-hidden="true" />
              Manage {bucket.name} in Settings
            </Button>
          )}
          <Button variant="tertiary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pt-2">
        {!isCurrentCycle && (
          <AlertBanner variant="info">
            Account editing and corrections use today's balance, not this cycle's closing balance. Any correction posts to today's cycle.
          </AlertBanner>
        )}
        <div className="overflow-hidden rounded-control bg-surface-2/70">
          <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3 text-caption text-muted-foreground">
            <span>Account</span>
            <span>{isCurrentCycle ? 'Current balance' : 'Balance at close'}</span>
          </div>
          <ul className="divide-y divide-border/60">
            {accounts.map(account => (
              <li key={account.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-[0.625rem]"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
                  >
                    <Wallet className="size-4" />
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('truncate text-body font-medium', account.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground')}>
                      {account.name}
                    </span>
                    {account.isArchived && <Badge>Closed</Badge>}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SensitiveAmount
                    value={account.remaining}
                    isMasked={amountsMasked}
                    formatFn={formatCurrency}
                    className={cn('text-body font-medium tabular-nums', account.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}
                  />
                  {onNavigateToAccounts && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => {
                        onNavigateToAccounts(account.id)
                        onClose()
                      }}
                      title={`Edit ${account.name} in Settings`}
                      aria-label={`Edit ${account.name} in Settings`}
                      className="px-2.5"
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-label text-foreground">
              <span className="whitespace-nowrap">{isCurrentCycle ? 'Total accounts balance' : 'Total balance at close'}</span>
              <Badge>{accountCount}</Badge>
            </span>
            <SensitiveAmount
              value={accounts.reduce((sum, account) => sum + account.remaining, 0)}
              isMasked={amountsMasked}
              formatFn={formatCurrency}
              className="shrink-0 text-subsection tabular-nums text-foreground"
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
