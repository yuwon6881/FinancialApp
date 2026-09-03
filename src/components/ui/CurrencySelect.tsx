import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { AlertCircle, Check, ChevronDown, Loader2, Search } from 'lucide-react'
import { fetchCurrencyCatalog, type CurrencyCatalogItem } from '../../lib/api'
import { AnchoredPopover } from './AnchoredPopover'
import { Input } from './Input'
import { controlTriggerClassName, type ControlSize } from './controlStyles'
import { useFormFieldControlProps } from './formFieldControl'

const CACHE_KEY = 'financial-app:currency-catalog:v1'
let memoryCatalog: CurrencyCatalogItem[] | null = null

export interface CurrencySelectProps {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
  id?: string
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  controlSize?: ControlSize
  'aria-describedby'?: string
}

function readCache(): CurrencyCatalogItem[] | null {
  if (memoryCatalog) return memoryCatalog
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    if (Array.isArray(parsed) && parsed.every(item =>
      typeof item?.code === 'string' && typeof item?.name === 'string' && typeof item?.symbol === 'string')) {
      memoryCatalog = parsed
      return parsed
    }
  } catch {
    // A corrupt/blocked cache should not prevent a fresh request.
  }
  return null
}

function writeCache(items: CurrencyCatalogItem[]) {
  memoryCatalog = items
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)) } catch { /* storage may be unavailable */ }
}

export function CurrencySelect({
  value,
  onChange,
  ariaLabel = 'Currency',
  className = '',
  id,
  disabled = false,
  invalid = false,
  required = false,
  controlSize = 'md',
  'aria-describedby': ariaDescribedBy,
}: CurrencySelectProps) {
  const cached = useMemo(() => readCache(), [])
  const [catalog, setCatalog] = useState<CurrencyCatalogItem[]>(cached ?? [])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(!cached)
  const [loadFailed, setLoadFailed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const accessibleProps = useFormFieldControlProps({
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': invalid || undefined,
    'aria-required': required || undefined,
  })
  const isInvalid = accessibleProps['aria-invalid'] === true
    || accessibleProps['aria-invalid'] === 'true'

  const load = () => {
    const abort = new AbortController()
    setLoading(true)
    setLoadFailed(false)
    fetchCurrencyCatalog(abort.signal).then(items => {
      if (!items.length) throw new Error('The currency catalog is empty.')
      writeCache(items)
      setCatalog(items)
    }).catch(error => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadFailed(true)
    }).finally(() => {
      if (!abort.signal.aborted) setLoading(false)
    })
    return abort
  }

  useEffect(() => {
    if (memoryCatalog) return
    const abort = load()
    return () => abort.abort()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const node = event.target as Node
      if (!rootRef.current?.contains(node) && !panelRef.current?.contains(node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', close)
    window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const selected = catalog.find(item => item.code === value)
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return needle
      ? catalog.filter(item => `${item.code} ${item.name} ${item.symbol}`.toLocaleLowerCase().includes(needle))
      : catalog
  }, [catalog, query])

  useEffect(() => setActiveIndex(0), [query, open])

  useEffect(() => {
    if (disabled) {
      setOpen(false)
      setQuery('')
    }
  }, [disabled])

  const choose = (item: CurrencyCatalogItem) => {
    onChange(item.code)
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 ${className}`}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
        } else if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          setActiveIndex(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
        } else if (open && event.key === 'Enter' && results[activeIndex]) {
          event.preventDefault()
          choose(results[activeIndex])
        }
      }}
    >
      <Button variant="tertiary"
        ref={triggerRef}
        type="button"
        id={accessibleProps.id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={accessibleProps['aria-labelledby']}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-describedby={accessibleProps['aria-describedby']}
        aria-invalid={accessibleProps['aria-invalid']}
        aria-required={accessibleProps['aria-required']}
        onClick={() => {
          if (!disabled) setOpen(current => !current)
        }}
        className={controlTriggerClassName({
          size: controlSize,
          invalid: isInvalid,
          className: 'disabled:cursor-not-allowed',
        })}
      >
        <span className="truncate">{selected?.label ?? (value || 'Select currency')}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </Button>
      <AnchoredPopover
        ref={panelRef}
        open={open}
        anchorRef={triggerRef}
        matchAnchorWidth
        minWidth={240}
        side="auto"
        role="presentation"
        aria-label={ariaLabel}
        className="z-[230] flex min-h-28 flex-col overflow-hidden rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"
      >
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search code, name, or symbol"
            role="combobox"
            aria-label={`Search ${ariaLabel.toLowerCase()}`}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={results[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
            autoComplete="off"
            controlSize="sm"
            className="mb-2 pl-9 pr-3"
          />
        </div>
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {loading && !catalog.length && <p className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading currencies…</p>}
          {loadFailed && !catalog.length && (
            <div className="p-3 text-xs text-amber-600 dark:text-amber-300">
              <p className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-3.5 shrink-0" /> Currency list unavailable. Reconnect and try again.</p>
              <Button variant="tertiary" type="button" onClick={() => load()} className="mt-2 font-bold text-blue-600 dark:text-blue-400">Retry</Button>
            </div>
          )}
          {results.map((item, index) => (
            <Button variant="tertiary"
              key={item.code}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={item.code === value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${index === activeIndex ? 'bg-muted' : 'hover:bg-muted'}`}
            >
              <span className="w-16 shrink-0 font-bold">{item.code} <span className="font-normal text-muted-foreground">{item.symbol}</span></span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
              {item.code === value && <Check className="size-3.5 shrink-0 text-blue-500" />}
            </Button>
          ))}
          {!loading && !loadFailed && results.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground">No supported currency matches.</p>}
        </div>
      </AnchoredPopover>
    </div>
  )
}
