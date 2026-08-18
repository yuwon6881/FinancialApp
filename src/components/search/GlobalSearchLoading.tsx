import { Search } from 'lucide-react'
import { Skeleton } from '../ui/Skeleton'

/**
 * Shown while the search module is still arriving. A `null` fallback made the trigger look broken:
 * the button pressed, nothing appeared, and the user pressed it again. This paints the overlay's
 * own shell immediately so the shape that lands is the shape that was promised, and it mirrors
 * `GlobalSearch`'s backdrop and panel geometry so the swap does not move anything.
 */
export function GlobalSearchLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-3 pt-12 backdrop-blur-md sm:pt-20"
      role="status"
      aria-busy="true"
      aria-label="Opening search"
    >
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
          <Search className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold text-muted-foreground">Opening search…</span>
        </div>
        <div className="space-y-2 p-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-2/3 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
