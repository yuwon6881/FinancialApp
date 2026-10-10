import React, { useState, useEffect } from 'react'
import { FolderCog } from 'lucide-react'
import type { InvestmentPortfolio } from '../../types'
import { PortfolioManagementRow } from './PortfolioManagementRow'
import { FormField } from '../ui/FormField'
import { Input } from '../ui/Input'
import { BottomSheet } from '../ui/BottomSheet'
import { InvestmentToolRow } from './InvestmentToolRow'
import { Tabs } from '../ui/Tabs'

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
      <InvestmentToolRow
        icon={<FolderCog className="size-4" />}
        title="Manage portfolio"
        subtitle={`${portfolio.accounts.length} account${portfolio.accounts.length === 1 ? '' : 's'} · ${portfolio.instruments.length} investment${portfolio.instruments.length === 1 ? '' : 's'}`}
        onClick={() => setOpen(true)}
        disabled={mutationsDisabled}
        expanded={open}
      />
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Manage portfolio" maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <Tabs
            value={tab}
            onValueChange={value => { setTab(value); setQuery('') }}
            options={[
              { value: 'accounts', label: `Accounts (${portfolio.accounts.length})`, panelId: 'portfolio-panel-accounts' },
              { value: 'investments', label: `Investments (${portfolio.instruments.length})`, panelId: 'portfolio-panel-investments' },
            ]}
            label="Portfolio sections"
            idPrefix="portfolio-tab"
            variant="segmented"
            className="grid min-w-0 grid-cols-2"
          />
          <FormField label={`Search ${tab}`} labelClassName="sr-only">
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}`} />
          </FormField>
          {tab === 'accounts' && <div id="portfolio-panel-accounts" role="tabpanel" aria-labelledby="portfolio-tab-accounts">
            <h3 className="text-label font-medium text-muted-foreground">Accounts</h3>
            <div className="mt-2 space-y-2">
              {portfolio.accounts.filter(value => matches(`${value.name} ${value.baseCurrency}`)).map(value => (
                <PortfolioManagementRow
                  key={value.id}
                  {...value}
                  details={value.baseCurrency}
                  entityLabel="account"
                  isSyncing={activeSyncIds.includes(value.id)}
                  mutationsDisabled={mutationsDisabled}
                  onArchive={() => onArchiveAccount(value.id)}
                  onDelete={() => onDeleteAccount(value.id)}
                  onUnarchive={() => onUnarchiveAccount(value.id, value.name, value.baseCurrency)}
                />
              ))}
            </div>
          </div>}
          {tab === 'investments' && <div id="portfolio-panel-investments" role="tabpanel" aria-labelledby="portfolio-tab-investments">
            <h3 className="text-label font-medium text-muted-foreground">Investments</h3>
            <div className="mt-2 space-y-2">
              {portfolio.instruments.filter(value => matches(`${value.symbol} ${value.name} ${value.currency}`)).map(value => (
                <PortfolioManagementRow
                  key={value.id}
                  {...value}
                  name={`${value.symbol} · ${value.name}`}
                  details={`${value.type === 'MutualFund' ? 'Mutual fund' : value.type} · ${value.currency} · ${value.isCustom ? 'Manual' : value.mic ?? value.exchange ?? 'Provider'}`}
                  entityLabel="investment"
                  isSyncing={activeSyncIds.includes(value.id)}
                  mutationsDisabled={mutationsDisabled}
                  onArchive={() => onArchiveInstrument(value.id)}
                  onDelete={() => onDeleteInstrument(value.id)}
                  onUnarchive={() => onUnarchiveInstrument(value.id)}
                />
              ))}
            </div>
          </div>}
        </div>
      </BottomSheet>
    </>
  )
}
