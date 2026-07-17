import { useState, useRef, useEffect } from 'react'
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
}

export function CustomSelect<T extends string | number>({ 
  value, 
  onChange, 
  options, 
  className = '',
  align = 'left',
  direction = 'down'
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="w-full h-10 flex items-center justify-between gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 text-xs bg-background border border-border rounded-xl text-foreground font-semibold shadow-xs hover:bg-muted/30 transition duration-150 cursor-pointer text-left select-none"
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground/80 transition duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnchoredPopover
        ref={panelRef}
        open={isOpen}
        anchorRef={triggerRef}
        align={align}
        side={direction === 'up' ? 'top' : 'bottom'}
        matchAnchorWidth
        minWidth={180}
        role="menu"
        className={`bg-card dark:bg-slate-900 border border-border rounded-xl shadow-xl p-1 z-[200] overflow-y-auto overscroll-contain animate-in fade-in ${direction === 'up' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'} duration-100 flex flex-col gap-0.5`}
      >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={opt.value === value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2 text-xs rounded-lg transition duration-100 cursor-pointer ${
                opt.value === value
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'hover:bg-muted/80 text-foreground font-medium'
              }`}
            >
              {opt.label}
            </button>
          ))}
      </AnchoredPopover>
    </div>
  )
}
