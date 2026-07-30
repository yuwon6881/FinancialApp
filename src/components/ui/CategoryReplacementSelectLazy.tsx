import { lazy, Suspense } from 'react'

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
const CategoryReplacementSelect = lazy(() =>
  import('./CategoryReplacementSelect').then(m => ({ default: m.CategoryReplacementSelect }))
)

interface CategoryReplacementSelectLazyProps {
  options: { id: string; name: string }[]
  onChange: (selected: string) => void
}

export function CategoryReplacementSelectLazy(props: CategoryReplacementSelectLazyProps) {
  return (
    // The fallback matches the control's height so the modal does not jump while the chunk loads.
    <Suspense fallback={<div className="h-9 rounded-xl bg-muted/40" />}>
      <CategoryReplacementSelect {...props} />
    </Suspense>
  )
}
