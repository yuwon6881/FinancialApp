import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { CustomSelect } from './CustomSelect'

export interface DataTableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Use when the surrounding card already owns the border and radius. */
  embedded?: boolean
  /** Disable horizontal scrolling when a fixed-layout table is designed to fit its frame. */
  horizontalOverflow?: 'auto' | 'hidden'
  tableClassName?: string
}

/**
 * Shared visible-table frame. The Ledger desktop table is the visual baseline:
 * one bordered Ayu surface, a horizontally scrollable table, and the same
 * header/body rhythm wherever a desktop table is used.
 */
export function DataTable({ children, embedded = false, horizontalOverflow = 'auto', tableClassName, className, ...props }: DataTableProps) {
  return (
    <div
      className={cn(
        'overflow-hidden',
        !embedded && 'rounded-2xl border border-border/60 bg-card shadow-xs',
        className,
      )}
      {...props}
    >
      <div className={horizontalOverflow === 'hidden' ? 'overflow-x-hidden' : 'overflow-x-auto'}>
        <table className={cn('w-full border-separate border-spacing-0 text-left text-xs', tableClassName)}>
          {children}
        </table>
      </div>
    </div>
  )
}

export function DataTableHeader({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead {...props}>
      <tr className={cn('border-b border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground select-none', className)}>
        {children}
      </tr>
    </thead>
  )
}

export function DataTableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-border/30 text-xs [&>tr>td]:p-4', className)} {...props}>
      {children}
    </tbody>
  )
}

export function DataTableHeaderCell({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn('p-4', className)} {...props}>
      {children}
    </th>
  )
}

export interface DataTableFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** A standalone footer is used when pagination follows a mobile/desktop list. */
  standalone?: boolean
}

export function DataTableFooter({ children, standalone = false, className, ...props }: DataTableFooterProps) {
  return (
    <div
      className={cn(
        standalone
          ? 'rounded-2xl border border-border/60 bg-card p-4 shadow-xs'
          : 'border-t border-border/50 p-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface DataTablePaginationProps {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
  serverIsFetching?: boolean
  pageSizeOptions?: readonly number[]
  showPageSize?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function pageNumbers(currentPage: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
  if (currentPage <= 3) return [1, 2, 3, '…', totalPages]
  if (currentPage >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages]
  return [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages]
}

export function DataTablePagination({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  serverIsFetching = false,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSize = true,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const displayFrom = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const displayTo = Math.min(currentPage * pageSize, totalItems)
  const previousDisabled = currentPage <= 1 || serverIsFetching
  const nextDisabled = currentPage >= safeTotalPages || serverIsFetching

  return (
    <div className="flex flex-col items-center justify-between gap-4 text-xs select-none sm:flex-row" aria-busy={serverIsFetching || undefined}>
      <div className="flex items-center gap-2 font-medium text-muted-foreground">
        {serverIsFetching && <Loader2 className="size-3.5 animate-spin text-accent-ink" aria-hidden="true" />}
        <span aria-live="polite" aria-atomic="true">
          {serverIsFetching ? (
            <>Loading entries {displayFrom}–{displayTo}…</>
          ) : (
            <>
              Showing <span className="font-semibold text-foreground">{displayFrom}</span> to{' '}
              <span className="font-semibold text-foreground">{displayTo}</span> of{' '}
              <span className="font-semibold text-foreground">{totalItems}</span> entries
            </>
          )}
        </span>
      </div>

      <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        {showPageSize && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">Rows per page:</span>
            {/* Locked mid-fetch: a second size change would only abort the request whose rows the
                footer is already describing. */}
            <CustomSelect
              ariaLabel="Rows per page"
              value={pageSize}
              onChange={value => onPageSizeChange(Number(value))}
              options={pageSizeOptions.map(value => ({ value, label: String(value) }))}
              className="w-20"
              direction="up"
              disabled={serverIsFetching}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={previousDisabled}
            className="sm:hidden"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Prev
          </Button>
          <span className="text-xs font-semibold text-muted-foreground sm:hidden">
            Page {currentPage} / {safeTotalPages}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={previousDisabled}
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              Previous
            </Button>
            {pageNumbers(currentPage, safeTotalPages).map((page, index) => page === '…' ? (
              <span key={`dots-${index}`} className="px-2 py-1.5 text-xs text-muted-foreground" aria-hidden="true">…</span>
            ) : (
              <Button
                key={`page-${page}`}
                variant={currentPage === page ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onPageChange(page)}
                disabled={serverIsFetching}
                aria-current={currentPage === page ? 'page' : undefined}
                className="min-w-8 px-2"
              >
                {page}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(Math.min(currentPage + 1, safeTotalPages))}
              disabled={nextDisabled}
            >
              Next
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.min(currentPage + 1, safeTotalPages))}
            disabled={nextDisabled}
            className="sm:hidden"
          >
            Next
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
