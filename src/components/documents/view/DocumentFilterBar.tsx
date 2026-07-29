import React, { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { CustomSelect } from '../../ui/CustomSelect'

interface DocumentFilterBarProps {
  search: string
  setSearch: (search: string) => void
  taxYear: number | undefined
  setTaxYear: (year: number | undefined) => void
}

const FIELD_CLASS =
  'w-full bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 transition'

export function DocumentFilterBar({ search, setSearch, taxYear, setTaxYear }: DocumentFilterBarProps) {
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
      <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search by file name or notes..."
          aria-label="Search documents"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className={`${FIELD_CLASS} py-2.5 pl-9 ${searchInput ? 'pr-9' : 'pr-3'}`}
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </form>

      <CustomSelect
        value={taxYear ?? ''}
        onChange={value => setTaxYear(value === '' ? undefined : Number(value))}
        options={[
          { value: '', label: 'All tax years' },
          ...Array.from({ length: 15 }, (_, i) => {
            const year = new Date().getFullYear() - i
            return { value: year, label: String(year) }
          }),
        ]}
        ariaLabel="Filter by tax year"
        className="w-full sm:w-40 sm:shrink-0"
      />
    </div>
  )
}
