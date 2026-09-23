import {
  DataTableFooter,
  DataTablePagination,
  type DataTablePaginationProps,
} from '../ui/DataTable'

export type LedgerPaginationProps = DataTablePaginationProps

// The Ledger keeps its existing pagination placement, while the controls and
// footer styling are shared with the Vault and Investment tables.
export function LedgerPagination(props: LedgerPaginationProps) {
  if (props.totalItems === 0) return null

  return (
    <DataTableFooter standalone>
      <DataTablePagination {...props} centerOnMobile />
    </DataTableFooter>
  )
}
