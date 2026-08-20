import { Button } from '../ui/Button'

interface LedgerEmptyStateProps {
  isFiltered: boolean
  onResetFilters: () => void
  onAddTransaction: () => void
}

export function LedgerEmptyState({ isFiltered, onResetFilters, onAddTransaction }: LedgerEmptyStateProps) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground">
      <p>{isFiltered ? 'No transactions match your filters' : 'No transactions in this cycle yet'}</p>
      <Button variant="secondary" size="sm" onClick={isFiltered ? onResetFilters : onAddTransaction}>
        {isFiltered ? 'Clear filters' : 'Post transaction'}
      </Button>
    </div>
  )
}
