import { useMemo, useState, type ReactNode } from 'react'
import type { CategoryFlowType } from '../../types'
import {
  filterAndGroupCategoryRows,
  type CategoryFlowFilterValue,
  type CategoryFlowRow,
} from '../../lib/categoryFlow'
import { CustomSelect } from '../ui/CustomSelect'

interface CategoryFlowFilterProps {
  rows: CategoryFlowRow[]
  flowTypeDrafts: Record<string, CategoryFlowType>
  children: (rows: CategoryFlowRow[]) => ReactNode
}

export function CategoryFlowFilter({ rows, flowTypeDrafts, children }: CategoryFlowFilterProps) {
  const [filter, setFilter] = useState<CategoryFlowFilterValue>('all')
  const visibleRows = useMemo(
    () => filterAndGroupCategoryRows(rows, flowTypeDrafts, filter),
    [filter, flowTypeDrafts, rows],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold text-muted-foreground">Category flow</span>
        <CustomSelect
          ariaLabel="Filter transaction categories by flow"
          value={filter}
          onChange={value => setFilter(value as CategoryFlowFilterValue)}
          options={[
            { value: 'all', label: 'All flow types' },
            { value: 'both', label: 'Both flows' },
            { value: 'inflow', label: 'Inflow only' },
            { value: 'outflow', label: 'Outflow only' },
          ]}
          controlSize="sm"
          className="w-36"
        />
      </div>
      {children(visibleRows)}
    </div>
  )
}
