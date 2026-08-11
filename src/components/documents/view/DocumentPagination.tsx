import { DataTableFooter, DataTablePagination } from '../../ui/DataTable'

interface DocumentPaginationProps {
  page: number
  pageSize: 10 | 25 | 50
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: 10 | 25 | 50) => void
}

export function DocumentPagination(props: DocumentPaginationProps) {
  if (props.totalCount <= 0) return null

  return (
    <DataTableFooter className="mt-4">
      <DataTablePagination
        currentPage={props.page}
        pageSize={props.pageSize}
        totalItems={props.totalCount}
        totalPages={props.totalPages}
        pageSizeOptions={[10, 25, 50]}
        onPageChange={props.onPageChange}
        onPageSizeChange={value => props.onPageSizeChange(value as 10 | 25 | 50)}
      />
    </DataTableFooter>
  )
}
