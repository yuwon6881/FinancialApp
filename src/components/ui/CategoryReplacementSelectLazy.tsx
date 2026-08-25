import { lazy, Suspense } from 'react'
import { loadCategoryReplacementSelect } from './categoryReplacementSelectChunk'

// Deferred wrapper around CategoryReplacementSelect.
//
// The picker is only ever rendered inside the "Delete Category" confirmation, but importing it
// statically from useFinancialData (which is on the eager critical path) pulled its whole
// transitive chain -- CustomSelect -> AnchoredPopover, the shared chunk that also carries
// DatePicker -- into the entry graph. That cost ~8.9 kB gzip before first paint for a modal most
// launches never open.
//
// This wrapper is what useFinancialData imports instead: the wrapper itself is trivially small and
// eager, while the picker and its popover chain stay in a chunk fetched when the modal opens. It
// lives in its own file so the hook module keeps exporting only hooks (react-refresh).
const CategoryReplacementSelect = lazy(loadCategoryReplacementSelect)

interface CategoryReplacementSelectLazyProps {
  options: { id: string; name: string }[]
  onChange: (selected: string) => void
}

export function CategoryReplacementSelectLazy(props: CategoryReplacementSelectLazyProps) {
  return (
    // Same height as the control so the modal does not jump, and labelled rather than blank: an
    // unlabelled grey bar reads as a picker with nothing in it.
    <Suspense fallback={<div className="flex h-9 items-center rounded-xl border border-border/60 bg-muted/40 px-3 text-xs text-muted-foreground">Loading categories…</div>}>
      <CategoryReplacementSelect {...props} />
    </Suspense>
  )
}
