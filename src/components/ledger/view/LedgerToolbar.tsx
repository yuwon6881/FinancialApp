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
      title="Financial Ledger"
      titleActions={<Tabs
        value={showAllCycles ? 'all' : 'current'}
        onValueChange={value => onShowAllCyclesChange(value === 'all')}
        options={[
          { value: 'current', label: 'Current cycle' },
          { value: 'all', label: 'All cycles' },
        ] as const}
        label="Ledger cycle scope"
        idPrefix="ledger-scope"
        variant="segmented"
      />}
      description={showAllCycles
        ? `Transactions across ${scopeLabel}. Search, filters, sorting, and paging run on the server.`
        : 'Transactions in the selected cycle. Search, filters, sorting, and paging run on this device.'}
      actions={<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
        <Button
          variant="secondary"
          onClick={onOpenExport}
          disabled={hideSensitive}
          className="flex-1 whitespace-nowrap lg:flex-initial"
          title={hideSensitive ? 'CSV export disabled while sensitive amounts are masked' : 'Export CSV'}
        >
          <Download className="size-3.5 text-muted-foreground" />
          Export CSV
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={onToggleForm}
          disabled={hideSensitive}
          title={hideSensitive ? 'Unhide balances to post a transaction' : undefined}
          className="flex-1 whitespace-nowrap lg:flex-initial"
        >
          {isFormOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {isFormOpen ? 'Cancel' : 'Post Transaction'}
        </Button>
      </div>}
    />
  )
}
