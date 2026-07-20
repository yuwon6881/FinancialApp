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
}: LedgerToolbarProps) {
  return (
    <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Financial Ledger</h2>

          <div className="flex items-center gap-1.5 select-none w-full sm:w-auto">
            <CustomSelect
              ariaLabel="Ledger cycle"
              value={selectedMonth}
              onChange={val => onSelectPeriod(String(val), selectedYear)}
              options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({
                value: m,
                label: getCycleLabelForDropdown(m, selectedYear, cycleDay),
              }))}
              className="flex-1 sm:w-56 sm:flex-initial"
            />
            <CustomSelect
              ariaLabel="Ledger cycle year"
              value={selectedYear}
              onChange={val => onSelectPeriod(selectedMonth, Number(val))}
              options={availableYears.map(y => ({
                value: y,
                label: y.toString(),
              }))}
              className="w-20 sm:w-28 shrink-0"
              align="right"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Comprehensive posting of all accounts and transactional balances for the currently selected cycle.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:gap-3">
        <button
          onClick={onOpenExport}
          disabled={hideSensitive}
          className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl border border-border font-medium text-xs transition duration-200 md:flex-initial ${
            hideSensitive
              ? 'opacity-40 cursor-not-allowed bg-background text-muted-foreground'
              : 'bg-background hover:bg-muted text-foreground cursor-pointer'
          }`}
          title={hideSensitive ? 'CSV Export disabled in blur mode' : 'Export CSV'}
        >
          <Download className="size-3.5 text-muted-foreground" />
          Export CSV
        </button>
        <Button
          variant="primary"
          size="lg"
          onClick={onToggleForm}
          className="flex-1 whitespace-nowrap rounded-xl text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 duration-200 md:flex-initial"
        >
          {isFormOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {isFormOpen ? 'Cancel' : 'Post Transaction'}
        </Button>
      </div>
    </Card>
  )
}
