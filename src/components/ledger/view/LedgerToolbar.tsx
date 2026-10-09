import { Download, Plus, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'
import { Tabs } from '../../ui/Tabs'

interface LedgerToolbarProps {
  selectedYear: number
  hideSensitive: boolean
  isFormOpen: boolean
  onToggleForm: () => void
  onOpenExport: () => void
  showAllCycles: boolean
  onShowAllCyclesChange: (showAllCycles: boolean) => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
}

export function LedgerToolbar({
  selectedYear,
  hideSensitive,
  isFormOpen,
  onToggleForm,
  onOpenExport,
  showAllCycles,
  onShowAllCyclesChange,
  cyclesRange,
}: LedgerToolbarProps) {
  const scopeLabel = cyclesRange === '3month'
    ? 'the last 3 cycles'
    : cyclesRange === '6month'
      ? 'the last 6 cycles'
      : cyclesRange === 'yearly'
        ? `all cycles in ${selectedYear}`
        : 'all saved cycles'

  return (
    <PageHeader
      title="Transactions"
      titleActions={<Tabs
        value={showAllCycles ? 'all' : 'current'}
        onValueChange={value => onShowAllCyclesChange(value === 'all')}
        options={[
          { value: 'current', label: 'This cycle' },
          { value: 'all', label: 'All cycles' },
        ] as const}
        label="Ledger cycle scope"
        idPrefix="ledger-scope"
        variant="segmented"
      />}
      description={showAllCycles ? `Showing ${scopeLabel}` : undefined}
      actions={<div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={onOpenExport}
          disabled={hideSensitive}
          className="whitespace-nowrap"
          title={hideSensitive ? 'CSV export disabled while sensitive amounts are masked' : 'Export CSV'}
        >
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
        <Button
          variant="primary"
          onClick={onToggleForm}
          disabled={hideSensitive}
          title={hideSensitive ? 'Unhide balances to post a transaction' : undefined}
          // A phone already has the + beside its tab bar for this, and the form opens over the page.
          className={isFormOpen ? 'whitespace-nowrap' : 'hidden whitespace-nowrap sm:inline-flex'}
        >
          {isFormOpen ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {isFormOpen ? 'Cancel' : 'Post Transaction'}
        </Button>
      </div>}
    />
  )
}
