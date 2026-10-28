export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100]

/**
 * Returns false when the table content fits on a single page at the smallest available page
 * size, suppressing unnecessary footer controls unless a background fetch is active.
 */
export function shouldShowPagination({
  totalPages,
  totalItems,
  serverIsFetching = false,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: {
  totalPages: number
  totalItems: number
  serverIsFetching?: boolean
  pageSizeOptions?: readonly number[]
}): boolean {
  if (serverIsFetching) return true
  const minPageSize = pageSizeOptions.length ? Math.min(...pageSizeOptions) : Infinity
  return !(totalPages <= 1 && totalItems <= minPageSize)
}
