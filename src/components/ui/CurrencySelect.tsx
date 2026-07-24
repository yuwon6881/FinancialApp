import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { fetchCurrencyCatalog, type CurrencyCatalogItem } from '../../lib/api'

let catalogCache: CurrencyCatalogItem[] | null = null

interface CurrencySelectProps {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
}

const fallback: CurrencyCatalogItem[] = [
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', label: 'MYR (RM)' },
  { code: 'USD', symbol: 'US$', name: 'US Dollar', label: 'USD (US$)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', label: 'SGD (S$)' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan', label: 'CNY (CN¥)' },
  { code: 'EUR', symbol: '€', name: 'Euro', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', name: 'Pound Sterling', label: 'GBP (£)' },
]

export function CurrencySelect({
  value,
  onChange,
  ariaLabel = 'Currency',
  className = '',
}: CurrencySelectProps) {
  const [catalog, setCatalog] = useState(catalogCache ?? fallback)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (catalogCache) return
    const abort = new AbortController()
    fetchCurrencyCatalog(abort.signal).then(items => {
      catalogCache = items
      setCatalog(items)
    }).catch(() => undefined)
    return () => abort.abort()
  }, [])

  const selected = catalog.find(item => item.code === value)
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (needle
      ? catalog.filter(item => `${item.code} ${item.name} ${item.symbol}`.toLowerCase().includes(needle))
      : catalog).slice(0, 40)
  }, [catalog, query])

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-left text-xs font-semibold"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-[220] mt-1 w-full min-w-56 rounded-xl border border-border bg-card p-2 shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search code or currency"
            className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-blue-500"
          />
          <div role="listbox" className="max-h-56 overflow-y-auto overscroll-contain">
            {results.map(item => (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={item.code === value}
                onClick={() => { onChange(item.code); setOpen(false); setQuery('') }}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"
              >
                <strong>{item.label}</strong>
                <span className="ml-2 text-muted-foreground">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
