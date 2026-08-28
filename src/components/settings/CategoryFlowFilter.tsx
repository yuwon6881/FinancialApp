import { useMemo, useState, type ReactNode } from 'react'
import {
  filterAndGroupCategoryRows,
  type CategoryFlowFilterValue,
  type CategoryFlowRow,
} from '../../lib/categoryFlow'
import { CustomSelect } from '../ui/CustomSelect'

interface CategoryFlowFilterProps {
  rows: CategoryFlowRow[]
  /**
   * Receives the filtered rows and the select itself, so the consumer decides where the control
   * sits. It used to render its own labelled row above the children, which put a third separate
   * control block between the add form and the search box.
   */
  children: (rows: CategoryFlowRow[], control: ReactNode) => ReactNode
}

export function CategoryFlowFilter({ rows, children }: CategoryFlowFilterProps) {
  const [filter, setFilter] = useState<CategoryFlowFilterValue>('all')
  const visibleRows = useMemo(
    () => filterAndGroupCategoryRows(rows, filter),
    [filter, rows],
  )

  const control = (
    <CustomSelect
      ariaLabel="Filter transaction categories by flow"
      value={filter}
      onChange={value => setFilter(value as CategoryFlowFilterValue)}
      options={[
        { value: 'all', label: 'All flows' },
        { value: 'both', label: 'Both flows' },
        { value: 'inflow', label: 'Inflow only' },
        { value: 'outflow', label: 'Outflow only' },
      ]}
      controlSize="sm"
      className="w-32 shrink-0"
    />
  )

  return <>{children(visibleRows, control)}</>
}
