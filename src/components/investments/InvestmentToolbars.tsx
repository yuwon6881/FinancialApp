import { Plus, Wallet, Building2, Search, RefreshCw, Loader2, TrendingUp } from 'lucide-react'
import type { InvestmentPortfolio } from '../../types'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'

export const ActionToolbar = ({
  portfolio,
  isOffline,
  refreshing,
  mutationsDisabled,
  onAddActivity,
  onManageCash,
  onAddAccount,
  onAddInvestment,
  onUpdatePrices,
}: {
  portfolio: InvestmentPortfolio
  isOffline: boolean
  refreshing: boolean
  mutationsDisabled: boolean
  onAddActivity: () => void
  onManageCash: () => void
  onAddAccount: () => void
  onAddInvestment: () => void
  onUpdatePrices: () => void
}) => (
  <section aria-label="Investment actions" className="app-panel flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/92 p-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:flex lg:flex-wrap">
      <Button variant="tertiary" disabled={mutationsDisabled || portfolio.accounts.length === 0 || portfolio.instruments.length === 0} onClick={onAddActivity}><Plus className="size-4" /> Add activity</Button>
      <Button variant="tertiary" disabled={mutationsDisabled || portfolio.accounts.length === 0} onClick={onManageCash}><Wallet className="size-4" /> Manage cash</Button>
      <Button variant="tertiary" disabled={mutationsDisabled} onClick={onAddAccount}><Building2 className="size-4" /> Add account</Button>
      <Button variant="tertiary" disabled={mutationsDisabled} onClick={onAddInvestment}><Search className="size-4" /> Add investment</Button>
    </div>
    <Button
      variant="tertiary"
      className="justify-center lg:w-auto"
      disabled={isOffline || refreshing || !portfolio.marketDataConfigured || !portfolio.holdings.length}
      aria-busy={refreshing}
      onClick={onUpdatePrices}
    >
      {refreshing
        ? <><Loader2 className="size-4 animate-spin" /> Updating…</>
        : <><RefreshCw className="size-4" /> Update prices</>}
    </Button>
  </section>
)

export const EmptyState = ({
  onAddAccount,
  onAddInvestment,
  mutationsDisabled,
}: {
  onAddAccount: () => void
  onAddInvestment: () => void
  mutationsDisabled: boolean
}) => (
  <Panel as="section" padding="none" className="px-6 py-14 text-center">
    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500"><TrendingUp className="size-7" /></div>
    <h2 className="mt-5 text-xl font-black text-foreground">Build your investment view</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
      Add an account and record a buy to get started.
    </p>
    <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
      <Button variant="primary" onClick={onAddAccount} disabled={mutationsDisabled}><Building2 className="size-4" /> Add account</Button>
      <Button variant="tertiary" onClick={onAddInvestment} disabled={mutationsDisabled}><Search className="size-4" /> Add investment</Button>
    </div>
  </Panel>
)
