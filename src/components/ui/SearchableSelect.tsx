import { useState, useRef, useEffect, useId } from 'react'
import { Button } from './Button'
import { ChevronDown, Search } from 'lucide-react'
import { AnchoredPopover } from './AnchoredPopover'
import { controlTriggerClassName, type ControlSize } from './controlStyles'
import { useFormFieldControlProps } from './formFieldControl'
import { Input } from './Input'

interface SelectOption<T extends string | number = string | number> {
  value: T
  label: string
  badge?: string
  disabled?: boolean
}

export interface SearchableSelectProps<T extends string | number = string | number> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  className?: string
  align?: 'left' | 'right'
  placeholder?: string
  ariaLabel?: string
  id?: string
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  controlSize?: ControlSize
  'aria-describedby'?: string
}

export function SearchableSelect<T extends string | number>({
  value,
  onChange,
  options,
  className = '',
  align = 'left',
  placeholder = 'Search…',
  ariaLabel = 'Choose an option',
  id,
  disabled = false,
  invalid = false,
  required = false,
  controlSize = 'md',
  'aria-describedby': ariaDescribedBy,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
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

  const selectedOption = options.find(opt => opt.value === value)

  const filtered = query.trim()
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(query.toLowerCase())
      )
    : options

  const open = () => {
    if (disabled) return
    const selectedIndex = filtered.findIndex(option => option.value === value && !option.disabled)
    const enabledIndex = filtered.findIndex(option => !option.disabled)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : enabledIndex)
    setIsOpen(true)
  }

  const close = (restoreFocus = false) => {
    setIsOpen(false)
    setQuery('')
    setActiveIndex(-1)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const moveActive = (delta: number) => {
    if (filtered.length === 0) return
    setActiveIndex(current => {
      let next = current < 0 ? (delta > 0 ? -1 : 0) : current
      for (let index = 0; index < filtered.length; index += 1) {
        next = (next + delta + filtered.length) % filtered.length
        if (!filtered[next]?.disabled) return next
      }
      return current
    })
  }

  const selectActive = () => {
    const option = filtered[activeIndex]
    if (!option || option.disabled) return
    onChange(option.value)
    close(true)
  }

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        close()
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

  useEffect(() => {
    if (disabled) close()
  }, [disabled])

  useEffect(() => {
    if (!isOpen) return
    const enabledIndex = filtered.findIndex(option => !option.disabled)
    if (activeIndex >= filtered.length || filtered[activeIndex]?.disabled) {
      setActiveIndex(enabledIndex)
    }
  }, [query, isOpen])

  return (
    <div
      className={`relative inline-block ${isOpen ? 'z-[120]' : 'z-0'} ${className}`}
      ref={containerRef}
      onKeyDown={event => {
        if (isOpen && event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          close(true)
        }
      }}
    >
      {/* Trigger button */}
      <Button variant="unstyled"
        type="button"
        id={accessibleProps.id}
        ref={triggerRef}
        onClick={() => isOpen ? close() : open()}
        onKeyDown={event => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !isOpen) {
            event.preventDefault()
            open()
          }
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={accessibleProps['aria-labelledby']}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-describedby={accessibleProps['aria-describedby']}
        aria-invalid={accessibleProps['aria-invalid']}
        aria-required={accessibleProps['aria-required']}
        className={controlTriggerClassName({
          size: controlSize,
          invalid: isInvalid,
          className: 'cursor-pointer disabled:cursor-not-allowed',
        })}
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <ChevronDown
          className={`size-3.5 text-muted-foreground/80 transition duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </Button>

      {/* Dropdown */}
      <AnchoredPopover
        ref={panelRef}
        open={isOpen}
        anchorRef={triggerRef}
        align={align}
        side="bottom"
        matchAnchorWidth
        minWidth={180}
        role="presentation"
        aria-label={ariaLabel ?? 'Choose an option'}
        className="bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100 flex min-h-0 flex-col"
      >
          {/* Search row */}
          <div className="p-2 border-b border-border/40">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 size-3 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                role="combobox"
                aria-label={`Search ${(ariaLabel ?? 'options').toLowerCase()}`}
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
                autoComplete="off"
                controlSize="sm"
                className="pl-7 pr-3 font-medium"
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveActive(1)
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    moveActive(-1)
                  } else if (event.key === 'Home') {
                    event.preventDefault()
                    setActiveIndex(filtered.findIndex(option => !option.disabled))
                  } else if (event.key === 'End') {
                    event.preventDefault()
                    let lastEnabled = -1
                    filtered.forEach((option, index) => {
                      if (!option.disabled) lastEnabled = index
                    })
                    setActiveIndex(lastEnabled)
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    selectActive()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    close(true)
                  }
                }}
              />
            </div>
          </div>

          {/* Options list */}
          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel ?? 'Choose an option'}
            className="min-h-0 flex-1 p-1 overflow-y-auto overscroll-contain flex flex-col gap-0.5"
          >
            {filtered.length > 0 ? (
              filtered.map((opt, index) => (
                <Button variant="unstyled"
                  key={opt.value}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  aria-disabled={opt.disabled || undefined}
                  disabled={opt.disabled}
                  tabIndex={-1}
                  onMouseEnter={() => {
                    if (!opt.disabled) setActiveIndex(index)
                  }}
                  onClick={() => {
                    if (opt.disabled) return
                    onChange(opt.value)
                    close(true)
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs rounded-lg transition duration-100 cursor-pointer ${
                    index === activeIndex
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'hover:bg-muted/80 text-foreground font-medium disabled:cursor-not-allowed disabled:opacity-45'
                  }`}
                >
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.badge && (
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-normal ${
                          opt.value === value
                            ? 'border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground'
                            : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </span>
                </Button>
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
