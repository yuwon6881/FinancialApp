import { Input } from '../../ui/Input'
import React, { useEffect, useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import { CustomSelect } from '../../ui/CustomSelect'
import { Button } from '../../ui/Button'
import { DOCUMENT_SORT_OPTIONS, type DocumentSort } from '../../../lib/documentOrdering'

interface DocumentFilterBarProps {
  search: string
  setSearch: (search: string) => void
  taxYear: number | undefined
  setTaxYear: (year: number | undefined) => void
  availableYears: number[]
  sortOrder: DocumentSort
  setSortOrder: (sort: DocumentSort) => void
  reliefCategoryLabel?: string
  onClearReliefCategory: () => void
}

const FIELD_CLASS =
  'w-full bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 transition'

export function DocumentFilterBar({
  search,
  setSearch,
  taxYear,
  setTaxYear,
  availableYears,
  sortOrder,
  setSortOrder,
  reliefCategoryLabel,
  onClearReliefCategory,
}: DocumentFilterBarProps) {
  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  const handleClear = () => {
    setSearchInput('')
    setSearch('')
  }

  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <form noValidate onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search by file name or notes..."
          aria-label="Search documents"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className={`${FIELD_CLASS} py-2.5 pl-9 ${searchInput ? 'pr-9' : 'pr-3'}`}
        />
        {searchInput && (
          <Button
            variant="unstyled"
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </form>

      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <CustomSelect
          value={sortOrder}
          onChange={value => setSortOrder(value as DocumentSort)}
          options={DOCUMENT_SORT_OPTIONS}
          ariaLabel="Sort vault documents"
          className="w-full sm:w-40 sm:shrink-0"
        />
        <CustomSelect
          value={taxYear ?? ''}
          onChange={value => setTaxYear(value === '' ? undefined : Number(value))}
          options={[
            { value: '', label: 'All tax years' },
            ...availableYears.map(year => ({ value: year, label: String(year) })),
          ]}
          ariaLabel="Filter by tax year"
          className="w-full sm:w-40 sm:shrink-0"
        />
      </div>

      {reliefCategoryLabel && (
        <Button
          variant="unstyled"
          type="button"
          onClick={onClearReliefCategory}
          aria-label={`Clear ${reliefCategoryLabel} relief filter`}
          className="inline-flex min-h-10 w-full shrink-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-left text-xs font-semibold text-primary transition hover:border-primary/60 hover:bg-primary/15 sm:w-auto sm:max-w-52"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate"><Filter className="size-3.5 shrink-0" /> {reliefCategoryLabel}</span>
          <X className="size-3.5 shrink-0" />
        </Button>
      )}
    </div>
  )
}
