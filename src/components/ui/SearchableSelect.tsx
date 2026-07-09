import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

interface SelectOption {
  value: string | number
  label: string
}

interface SearchableSelectProps {
  value: string | number
  onChange: (value: any) => void
  options: SelectOption[]
  className?: string
  align?: 'left' | 'right'
  placeholder?: string
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  align = 'left',
  placeholder = 'Search…',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 py-2 text-xs bg-background border border-border rounded-xl text-foreground font-semibold shadow-xs hover:bg-muted/30 transition duration-150 cursor-pointer text-left select-none"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <ChevronDown
          className={`size-3.5 text-muted-foreground/80 transition duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 min-w-[180px] w-max max-w-[calc(100vw-32px)] sm:max-w-[280px] bg-card dark:bg-slate-900 border border-border rounded-xl shadow-xl z-[120] animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col`}
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
          <div className="p-1 max-h-52 overflow-y-auto flex flex-col gap-0.5">
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
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
                  {opt.label}
                </button>
              ))
            ) : (
              <p className="px-3.5 py-3 text-xs text-muted-foreground text-center font-medium">
                No categories match "{query}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
