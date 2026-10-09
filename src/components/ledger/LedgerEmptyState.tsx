import { Inbox, SearchX } from 'lucide-react'
import { Button } from '../ui/Button'

interface LedgerEmptyStateProps {
  isFiltered: boolean
  onResetFilters: () => void
  onAddTransaction: () => void
}

export function LedgerEmptyState({ isFiltered, onResetFilters, onAddTransaction }: LedgerEmptyStateProps) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted-foreground">
        {isFiltered ? <SearchX className="size-5" /> : <Inbox className="size-5" />}
      </span>
      <p className="text-callout text-foreground">{isFiltered ? 'No transactions match your filters' : 'No transactions in this cycle yet'}</p>
      <Button variant="secondary" size="sm" onClick={isFiltered ? onResetFilters : onAddTransaction}>
        {isFiltered ? 'Clear filters' : 'Post transaction'}
      </Button>
    </div>
  )
}
