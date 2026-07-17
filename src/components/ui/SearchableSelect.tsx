import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { AnchoredPopover } from './AnchoredPopover'

interface SelectOption<T extends string | number = string | number> {
  value: T
  label: string
  badge?: string
}

interface SearchableSelectProps<T extends string | number = string | number> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  className?: string
  align?: 'left' | 'right'
  placeholder?: string
}

export function SearchableSelect<T extends string | number>({
  value,
  onChange,
  options,
  className = '',
  align = 'left',
  placeholder = 'Search…',
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  const filtered = query.trim()
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(query.toLowerCase())
      )
    : options

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Small delay lets the dropdown animate in before focus
      const t = setTimeout(() => searchRef.current?.focus(), 60)
      return () => clearTimeout(t)
    } else {
      setQuery('')
    }
  }, [isOpen])

  return (
    <div
      className={`relative inline-block ${isOpen ? 'z-[120]' : 'z-0'} ${className}`}
      ref={containerRef}
      onKeyDown={event => {
        if (isOpen && event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(false)
          triggerRef.current?.focus()
        }
      }}
    >
      {/* Trigger button */}
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="w-full h-10 flex items-center justify-between gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold shadow-xs hover:bg-muted/30 transition duration-150 cursor-pointer text-left select-none"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <ChevronDown
          className={`size-3.5 text-muted-foreground/80 transition duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnchoredPopover
        ref={panelRef}
        open={isOpen}
        anchorRef={triggerRef}
        align={align}
        side="bottom"
        matchAnchorWidth
        minWidth={180}
        role="dialog"
        aria-label="Choose an option"
        className="bg-card dark:bg-slate-900 border border-border rounded-xl shadow-xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100 flex min-h-0 flex-col"
      >
          {/* Search row */}
          <div className="p-2 border-b border-border/40">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 size-3 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-muted/50 border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-150 font-medium"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="min-h-0 flex-1 p-1 overflow-y-auto overscroll-contain flex flex-col gap-0.5">
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={opt.value === value}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                    setQuery('')
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs rounded-lg transition duration-100 cursor-pointer ${
                    opt.value === value
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'hover:bg-muted/80 text-foreground font-medium'
                  }`}
                >
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.badge && (
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-normal ${
                          opt.value === value
                            ? 'border-white/30 bg-white/15 text-white'
                            : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3.5 py-3 text-xs text-muted-foreground text-center font-medium">
                No categories match "{query}"
              </p>
            )}
          </div>
      </AnchoredPopover>
    </div>
  )
}
