import React, { useState, useEffect } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import type { InvestmentPortfolio } from '../../types'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { BottomSheet } from '../ui/BottomSheet'
import { Panel } from '../ui/Panel'

export interface AccountsAndInstrumentsProps {
  portfolio: InvestmentPortfolio
  onArchiveAccount: (id: string) => void
  onUnarchiveAccount: (id: string, name: string, currency: string) => void
  onDeleteAccount: (id: string) => void
  onDeleteInstrument: (id: string) => void
  onArchiveInstrument: (id: string) => void
  onUnarchiveInstrument: (id: string) => void
  activeSyncIds: string[]
  mutationsDisabled: boolean
}

export const AccountsAndInstruments: React.FC<AccountsAndInstrumentsProps> = ({
  portfolio,
  onArchiveAccount,
  onUnarchiveAccount,
  onDeleteAccount,
  onDeleteInstrument,
  onArchiveInstrument,
  onUnarchiveInstrument,
  activeSyncIds,
  mutationsDisabled,
}) => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'accounts' | 'investments'>('accounts')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (mutationsDisabled) setOpen(false)
  }, [mutationsDisabled])

  const matches = (value: string) => value.toLowerCase().includes(query.trim().toLowerCase())

  return (
    <>
      <Panel
        as={Button}
        padding="none"
        variant="unstyled"
        type="button"
        onClick={() => setOpen(true)}
        disabled={mutationsDisabled}
        aria-expanded={open}
        className="interactive-card group flex w-full cursor-pointer items-center justify-between p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <strong className="text-sm text-foreground">Manage portfolio</strong>
          <span className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold tracking-wide text-blue-600 dark:text-blue-400">{portfolio.accounts.length} ACCOUNT{portfolio.accounts.length === 1 ? '' : 'S'}</span>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold tracking-wide text-violet-600 dark:text-violet-400">{portfolio.instruments.length} INVESTMENT{portfolio.instruments.length === 1 ? '' : 'S'}</span>
          </span>
        </span>
        <ChevronDown className="size-4 -rotate-90 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" />
      </Panel>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Manage portfolio" maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <div className="flex rounded-xl bg-muted/40 p-1">
            {([
              ['accounts', `Accounts (${portfolio.accounts.length})`],
              ['investments', `Investments (${portfolio.instruments.length})`],
            ] as const).map(([value, label]) => <Button key={value} variant="unstyled" type="button" onClick={() => { setTab(value); setQuery('') }} aria-pressed={tab === value} className={`min-w-0 flex-1 cursor-pointer rounded-lg px-2 py-2 text-xs font-bold sm:text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>{label}</Button>)}
          </div>
          <FormField label={`Search ${tab}`} labelClassName="sr-only">
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}`} />
          </FormField>
          {tab === 'accounts' && <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Accounts</h3>
            <div className="mt-2 space-y-2">
              {portfolio.accounts.filter(value => matches(`${value.name} ${value.baseCurrency}`)).map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                  <span className="min-w-0">
                    <strong className="flex min-w-0 items-center gap-2 text-xs text-foreground">
                      <span className="truncate">{value.name}</span>
                      <RowSyncStatus
                        isDeleting={Boolean(value.isPendingDelete)}
                        isSyncing={activeSyncIds.includes(value.id)}
                        isPending={value.isPendingSync && !activeSyncIds.includes(value.id)}
                        entityLabel="account"
                      />
                      {!value.canDelete && !value.canArchive && !value.isArchived && (
                        <span title="Close all positions and set cash to zero before archiving." className="flex shrink-0 cursor-help items-center gap-1.5 rounded-md px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/10">
                          <Info className="size-3.5" />
                          <span className="text-xs font-medium">Cannot archive</span>
                        </span>
                      )}
                    </strong>
                    <span className="text-xs text-muted-foreground">{value.baseCurrency}{value.isArchived ? ' · Archived' : ''}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {value.isArchived ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={mutationsDisabled || Boolean(value.isPendingSync || value.isPendingDelete)}
                        onClick={() => onUnarchiveAccount(value.id, value.name, value.baseCurrency)}
                      >
                        Unarchive
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={mutationsDisabled || Boolean(value.isPendingSync || value.isPendingDelete) || (!value.canDelete && !value.canArchive)}
                        title={value.archiveUnavailableReason}
                        onClick={() => value.canDelete ? onDeleteAccount(value.id) : onArchiveAccount(value.id)}
                      >
                        {value.canDelete ? 'Delete' : 'Archive'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Archive preserves closed-account history.</p>
          </div>}
          {tab === 'investments' && <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Investments</h3>
            <div className="mt-2 space-y-2">
              {portfolio.instruments.filter(value => matches(`${value.symbol} ${value.name} ${value.currency}`)).map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3" aria-busy={value.isPendingSync || value.isPendingDelete || activeSyncIds.includes(value.id)}>
                  <span className="min-w-0">
                    <strong className="flex min-w-0 items-center gap-2 text-xs text-foreground">
                      <span className="truncate">{value.symbol} · {value.name}</span>
                      <RowSyncStatus
                        isDeleting={Boolean(value.isPendingDelete)}
                        isSyncing={activeSyncIds.includes(value.id)}
                        isPending={value.isPendingSync && !activeSyncIds.includes(value.id)}
                        entityLabel="investment"
                      />
                      {!value.canDelete && !value.canArchive && !value.isArchived && (
                        <span title={value.archiveUnavailableReason} className="flex shrink-0 cursor-help items-center gap-1.5 rounded-md px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/10">
                          <Info className="size-3.5" />
                          <span className="text-xs font-medium">Cannot archive</span>
                        </span>
                      )}
                    </strong>
                    <span className="text-xs text-muted-foreground">{value.type} · {value.currency} · {value.isCustom ? 'Manual' : value.mic ?? value.exchange ?? 'Provider'}</span>
                  </span>
                  <Button
                    variant={value.isArchived ? 'ghost' : 'danger'}
                    size="sm"
                    disabled={mutationsDisabled || Boolean(value.isPendingSync || value.isPendingDelete) || (!value.isArchived && !value.canDelete && !value.canArchive)}
                    title={value.archiveUnavailableReason}
                    onClick={() => value.isArchived
                      ? onUnarchiveInstrument(value.id)
                      : value.canDelete
                        ? onDeleteInstrument(value.id)
                        : onArchiveInstrument(value.id)}
                  >
                    {value.isArchived ? 'Unarchive' : value.canDelete ? 'Delete' : 'Archive'}
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Delete only unused investments. Close active ones to keep their history.</p>
          </div>}
        </div>
      </BottomSheet>
    </>
  )
}
