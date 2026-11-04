import { AlertCircle, ChevronDown } from 'lucide-react'

/** Why some portfolio figures are missing: the notes from the last server calculation. */
export function CalculationWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <details className="group">
      <summary id="calculation-warnings" className="flex min-h-16 cursor-pointer select-none items-center gap-3 px-5 py-3 outline-none transition-colors hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-6">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300"><AlertCircle className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium text-foreground">Why some figures are missing</span>
          <span className="block text-caption text-muted-foreground">{warnings.length} note{warnings.length === 1 ? '' : 's'} from the last calculation</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="space-y-1.5 px-5 pb-4 sm:px-6">
        {warnings.map(warning => (
          <li key={warning} className="flex items-start gap-2 text-caption text-muted-foreground">
            <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
            <span className="min-w-0">{warning}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
