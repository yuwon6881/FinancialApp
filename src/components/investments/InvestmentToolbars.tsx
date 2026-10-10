import { Plus, Wallet, Building2, Search, RefreshCw, Loader2, TrendingUp } from 'lucide-react'
import type { InvestmentPortfolio } from '../../types'
import { Button } from '../ui/Button'
import { EmptyState as SharedEmptyState } from '../ui/EmptyState'

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
  // One row of pills. On a phone it scrolls sideways instead of wrapping into a two-by-three grid
  // of half-width buttons; the bleed lets the last pill run to the panel's edge so the scroll reads.
  <div
    role="group"
    aria-label="Investment actions"
    className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
  >
    <Button variant="primary" size="sm" className="shrink-0 whitespace-nowrap" disabled={mutationsDisabled || portfolio.accounts.length === 0 || portfolio.instruments.length === 0} onClick={onAddActivity}><Plus className="size-4" aria-hidden="true" /> Add activity</Button>
    <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" disabled={mutationsDisabled || portfolio.accounts.length === 0} onClick={onManageCash}><Wallet className="size-4" aria-hidden="true" /> Manage cash</Button>
    <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" disabled={mutationsDisabled} onClick={onAddAccount}><Building2 className="size-4" aria-hidden="true" /> Add account</Button>
    <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" disabled={mutationsDisabled} onClick={onAddInvestment}><Search className="size-4" aria-hidden="true" /> Add investment</Button>
    <Button
      variant="secondary"
      size="sm"
      className="shrink-0 whitespace-nowrap lg:ml-auto"
      disabled={isOffline || refreshing || !portfolio.marketDataConfigured || !portfolio.holdings.length}
      aria-busy={refreshing}
      onClick={onUpdatePrices}
    >
      {refreshing
        ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Updating…</>
        : <><RefreshCw className="size-4" aria-hidden="true" /> Update prices</>}
    </Button>
  </div>
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
  <SharedEmptyState
    icon={<TrendingUp className="size-6" aria-hidden="true" />}
    title="Build your investment view"
    description="Add an account and record a buy to get started."
    actions={<>
      <Button variant="primary" onClick={onAddAccount} disabled={mutationsDisabled}><Building2 className="size-4" aria-hidden="true" /> Add account</Button>
      <Button variant="secondary" onClick={onAddInvestment} disabled={mutationsDisabled}><Search className="size-4" aria-hidden="true" /> Add investment</Button>
    </>}
  />
)
