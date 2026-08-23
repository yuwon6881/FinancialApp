import { Download, Plus, X } from 'lucide-react'
import { Card } from '../../ui/Card'
import { CustomSelect } from '../../ui/CustomSelect'
import { Button } from '../../ui/Button'
import { getCycleLabelForDropdown } from '../../../lib/cycleLabels'

interface LedgerToolbarProps {
  selectedMonth: string
  selectedYear: number
  availableYears: number[]
  cycleDay: number
  onSelectPeriod: (month: string, year: number) => void
  hideSensitive: boolean
  isFormOpen: boolean
  onToggleForm: () => void
  onOpenExport: () => void
  showAllCycles: boolean
  onShowAllCyclesChange: (showAllCycles: boolean) => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
}

export function LedgerToolbar({
  selectedMonth,
  selectedYear,
  availableYears,
  cycleDay,
  onSelectPeriod,
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
    <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="min-w-0 w-full md:flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Financial Ledger</h2>

          <div className="flex rounded-xl border border-border/70 bg-background p-1" role="group" aria-label="Ledger cycle scope">
            <Button
              variant={showAllCycles ? 'unstyled' : 'secondary'}
              size="sm"
              onClick={() => onShowAllCyclesChange(false)}
              aria-pressed={!showAllCycles}
              className="rounded-lg px-3 text-xs"
            >
              Current cycle
            </Button>
            <Button
              variant={showAllCycles && cyclesRange === 'all' ? 'secondary' : 'unstyled'}
              size="sm"
              onClick={() => onShowAllCyclesChange(true)}
              aria-pressed={showAllCycles && cyclesRange === 'all'}
              className="rounded-lg px-3 text-xs"
            >
              All cycles
            </Button>
          </div>

          {(!showAllCycles || (cyclesRange !== 'all' && cyclesRange !== 'monthly')) && (
            <div className="flex w-full min-w-0 items-center gap-1.5 select-none sm:w-auto">
              {cyclesRange !== 'yearly' && (
                <CustomSelect
                  ariaLabel={showAllCycles ? 'Ledger range ending cycle' : 'Ledger cycle'}
                  value={selectedMonth}
                  onChange={val => onSelectPeriod(String(val), selectedYear)}
                  options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({
                    value: m,
                    label: getCycleLabelForDropdown(m, selectedYear, cycleDay),
                  }))}
                  className="w-0 min-w-0 flex-1 sm:w-56 sm:flex-initial"
                />
              )}
              <CustomSelect
                ariaLabel={cyclesRange === 'yearly' ? 'Ledger range year' : 'Ledger cycle year'}
                value={selectedYear}
                onChange={val => onSelectPeriod(selectedMonth, Number(val))}
                options={availableYears.map(y => ({ value: y, label: y.toString() }))}
                className="w-28 shrink-0"
                align="right"
              />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {showAllCycles
            ? `Saved transactions across ${scopeLabel}. Filters, sorting, paging, and full export are handled by the server.`
            : 'Transactions in the selected cycle. Search, filters, sorting, and paging update instantly on this device.'}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:gap-3">
        <Button
          variant="outline"
          onClick={onOpenExport}
          disabled={hideSensitive}
          className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs md:flex-initial ${
            hideSensitive
              ? 'opacity-40 cursor-not-allowed text-muted-foreground'
              : 'cursor-pointer'
          }`}
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
          className="flex-1 whitespace-nowrap rounded-xl text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 md:flex-initial"
        >
          {isFormOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {isFormOpen ? 'Cancel' : 'Post Transaction'}
        </Button>
      </div>
    </Card>
  )
}
