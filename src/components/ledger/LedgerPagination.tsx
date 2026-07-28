import { Loader2 } from 'lucide-react'
import { CustomSelect } from '../ui/CustomSelect'

interface LedgerPaginationProps {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
  serverIsFetching: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

// Unified pagination controls shared by client (local slice) and server
// (all-cycles paged) modes. The parent resolves totalItems/totalPages for the
// active mode; this component owns only the rendering + page-number window.
export function LedgerPagination({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  serverIsFetching,
  onPageChange,
  onPageSizeChange,
}: LedgerPaginationProps) {
  if (totalItems === 0) return null

  const displayFrom = (currentPage - 1) * pageSize + 1
  const displayTo = Math.min(currentPage * pageSize, totalItems)

  const renderPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
      }
    }
    return pages.map((p, idx) => (
      p === '...' ? (
        <span key={`dots-${idx}`} className="px-2 py-1.5 text-muted-foreground text-xs select-none">...</span>
      ) : (
        <button
          key={`page-${p}`}
          onClick={() => onPageChange(p as number)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
            currentPage === p
              ? 'bg-primary border-primary text-primary-foreground shadow-xs'
              : 'border-border bg-background hover:bg-muted text-foreground'
          }`}
        >
          {p}
        </button>
      )
    ))
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card border border-border/60 rounded-2xl shadow-xs text-xs select-none">
      <div className="text-muted-foreground font-medium flex items-center gap-2">
        {serverIsFetching && <Loader2 className="size-3.5 animate-spin text-blue-500" />}
        Showing <span className="text-foreground font-semibold">{displayFrom}</span> to{' '}
        <span className="text-foreground font-semibold">{displayTo}</span>{' '}
        of <span className="text-foreground font-semibold">{totalItems}</span> entries
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full sm:w-auto">
        {/* Page size select dropdown selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium">Rows per page:</span>
          <CustomSelect
            ariaLabel="Rows per page"
            value={pageSize}
            onChange={(val) => onPageSizeChange(Number(val))}
            options={[
              { value: 10, label: '10' },
              { value: 25, label: '25' },
              { value: 50, label: '50' },
              { value: 100, label: '100' }
            ]}
            className="w-24"
            direction="up"
          />
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 sm:hidden">
            <button
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1 || serverIsFetching}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
            >
              Prev
            </button>
            <span className="text-[10px] text-muted-foreground font-semibold">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages || serverIsFetching}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1 || serverIsFetching}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
            >
              Previous
            </button>
            {renderPageNumbers()}
            <button
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages || serverIsFetching}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
