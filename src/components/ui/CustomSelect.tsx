import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnchoredPopover } from './AnchoredPopover'

interface SelectOption<T extends string | number = string | number> {
  value: T
  label: string
}

interface CustomSelectProps<T extends string | number = string | number> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  className?: string
  align?: 'left' | 'right'
  direction?: 'up' | 'down'
  ariaLabel?: string
}

export function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  className = '',
  align = 'left',
  direction = 'down',
  ariaLabel = 'Select an option',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const typeaheadRef = useRef('')
  const typeaheadTimerRef = useRef<number | null>(null)

  const selectedOption = options.find(option => option.value === value)
  const selectedIndex = options.findIndex(option => option.value === value)

  const openWithIndex = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    setActiveIndex(Math.max(0, Math.min(options.length - 1, index)))
    setIsOpen(true)
  }

  const selectIndex = (index: number) => {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setActiveIndex(index)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target)
        && panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current)
    }
  }, [])

  return (
    <div
      className={`relative inline-block ${isOpen ? 'z-[120]' : 'z-0'} ${className}`}
      ref={containerRef}
      onKeyDown={event => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(false)
          triggerRef.current?.focus()
          return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const delta = event.key === 'ArrowDown' ? 1 : -1
          if (!isOpen) {
            openWithIndex(selectedIndex >= 0 ? selectedIndex : (delta > 0 ? 0 : options.length - 1))
          } else {
            setActiveIndex(current => (current + delta + options.length) % options.length)
          }
          return
        }
        if (isOpen && event.key === 'Home') {
          event.preventDefault()
          setActiveIndex(0)
          return
        }
        if (isOpen && event.key === 'End') {
          event.preventDefault()
          setActiveIndex(options.length - 1)
          return
        }
        if (isOpen && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          selectIndex(activeIndex)
          return
        }
        if (isOpen && event.key === 'Tab') {
          setIsOpen(false)
          return
        }
        if (event.key.length === 1 && /\S/.test(event.key)) {
          typeaheadRef.current += event.key.toLowerCase()
          if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current)
          typeaheadTimerRef.current = window.setTimeout(() => { typeaheadRef.current = '' }, 500)
          const matchIndex = options.findIndex(option => option.label.toLowerCase().startsWith(typeaheadRef.current))
          if (matchIndex >= 0) {
            event.preventDefault()
            if (!isOpen) openWithIndex(matchIndex)
            else setActiveIndex(matchIndex)
          }
        }
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        onClick={() => isOpen ? setIsOpen(false) : openWithIndex()}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        className="w-full h-10 flex items-center justify-between gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold shadow-xs hover:bg-muted/30 transition duration-150 cursor-pointer text-left select-none"
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground/80 transition duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnchoredPopover
        ref={panelRef}
        id={listboxId}
        open={isOpen}
        anchorRef={triggerRef}
        align={align}
        side={direction === 'up' ? 'top' : 'bottom'}
        matchAnchorWidth
        minWidth={180}
        role="listbox"
        aria-label={ariaLabel}
        className={`bg-card dark:bg-slate-900 border border-border rounded-xl shadow-xl p-1 z-[200] overflow-y-auto overscroll-contain animate-in fade-in ${direction === 'up' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'} duration-100 flex flex-col gap-0.5`}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            id={`${listboxId}-option-${index}`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            tabIndex={-1}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectIndex(index)}
            className={`w-full text-left px-3.5 py-2 text-xs rounded-lg transition duration-100 cursor-pointer ${
              index === activeIndex
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'hover:bg-muted/80 text-foreground font-medium'
            }`}
          >
            {option.label}
          </button>
        ))}
      </AnchoredPopover>
    </div>
  )
}
