import { useEffect, useId, useRef, useState, type FocusEventHandler } from 'react'
import { Button } from './Button'
import { ChevronDown } from 'lucide-react'
import { AnchoredPopover } from './AnchoredPopover'
import { controlTriggerClassName, type ControlSize } from './controlStyles'
import { useFormFieldControlProps } from './formFieldControl'

export interface SelectOption<T extends string | number = string | number> {
  value: T
  label: string
  badge?: string
  disabled?: boolean
}

export interface CustomSelectProps<T extends string | number = string | number> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
  direction?: 'up' | 'down'
  ariaLabel?: string
  id?: string
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  controlSize?: ControlSize
  'aria-describedby'?: string
  onBlur?: FocusEventHandler<HTMLButtonElement>
}

export function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  align = 'left',
  direction = 'down',
  ariaLabel,
  id,
  disabled = false,
  invalid = false,
  required = false,
  controlSize = 'md',
  'aria-describedby': ariaDescribedBy,
  onBlur,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const typeaheadRef = useRef('')
  const typeaheadTimerRef = useRef<number | null>(null)
  const accessibleProps = useFormFieldControlProps({
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': invalid || undefined,
    'aria-required': required || undefined,
  })
  // An explicit ariaLabel is a deliberate per-instance name and outranks the inherited FormField
  // label; without one the field falls back to that label, and only then to the generic default.
  const hasExplicitLabel = ariaLabel !== undefined
  const inheritedLabelledBy = hasExplicitLabel ? undefined : accessibleProps['aria-labelledby']
  const resolvedAriaLabel = ariaLabel ?? (inheritedLabelledBy ? undefined : 'Select an option')
  const isInvalid = accessibleProps['aria-invalid'] === true
    || accessibleProps['aria-invalid'] === 'true'

  const selectedOption = options.find(option => option.value === value)
  const selectedIndex = options.findIndex(option => option.value === value)
  const isPlaceholderDisplayed = !selectedOption && Boolean(placeholder) && (value === '' || value === undefined || value === null)
  const displayLabel = selectedOption?.label || (value !== '' && value !== undefined && value !== null ? String(value) : (placeholder ?? ''))

  const openWithIndex = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (disabled || options.length === 0) return
    let nextIndex = Math.max(0, Math.min(options.length - 1, index))
    if (options[nextIndex]?.disabled) {
      const enabledIndex = options.findIndex(option => !option.disabled)
      if (enabledIndex < 0) return
      nextIndex = enabledIndex
    }
    setActiveIndex(nextIndex)
    setIsOpen(true)
  }

  const selectIndex = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setActiveIndex(index)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (disabled) setIsOpen(false)
  }, [disabled])

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
          if (disabled || options.length === 0) return
          const delta = event.key === 'ArrowDown' ? 1 : -1
          if (!isOpen) {
            openWithIndex(selectedIndex >= 0 ? selectedIndex : (delta > 0 ? 0 : options.length - 1))
          } else {
            setActiveIndex(current => {
              let next = current
              for (let i = 0; i < options.length; i += 1) {
                next = (next + delta + options.length) % options.length
                if (!options[next]?.disabled) return next
              }
              return current
            })
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
          const matchIndex = options.findIndex(option =>
            !option.disabled && option.label.toLowerCase().startsWith(typeaheadRef.current))
          if (matchIndex >= 0) {
            event.preventDefault()
            if (!isOpen) openWithIndex(matchIndex)
            else setActiveIndex(matchIndex)
          }
        }
      }}
    >
      <Button variant="unstyled"
        type="button"
        id={accessibleProps.id}
        ref={triggerRef}
        onClick={() => isOpen ? setIsOpen(false) : openWithIndex()}
        onBlur={onBlur}
        disabled={disabled}
        role="combobox"
        aria-label={resolvedAriaLabel}
        aria-labelledby={inheritedLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-describedby={accessibleProps['aria-describedby']}
        aria-invalid={accessibleProps['aria-invalid']}
        aria-required={accessibleProps['aria-required']}
        className={controlTriggerClassName({
          size: controlSize,
          invalid: isInvalid,
          className: 'cursor-pointer disabled:cursor-not-allowed',
        })}
      >
        <span className={`min-w-0 flex-1 truncate ${isPlaceholderDisplayed ? 'text-muted-foreground/70 font-normal' : ''}`}>{displayLabel}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground/80 transition duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

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
        aria-label={ariaLabel ?? 'Select an option'}
        className={`bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 z-[200] overflow-y-auto overscroll-contain animate-in fade-in ${direction === 'up' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'} duration-100 space-y-0.5`}
      >
        {options.map((option, index) => (
          <Button variant="unstyled"
            key={option.value}
            id={`${listboxId}-option-${index}`}
            type="button"
            role="option"
            aria-label={option.badge ? `${option.label}, ${option.badge}` : undefined}
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            disabled={option.disabled}
            tabIndex={-1}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectIndex(index)}
            className={`h-auto min-h-9 w-full min-w-0 shrink-0 px-3.5 py-2 text-left text-xs leading-4 rounded-lg transition duration-100 cursor-pointer ${option.badge ? 'flex items-center justify-between gap-2' : 'block truncate whitespace-nowrap'} ${
              index === activeIndex
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'hover:bg-muted/80 text-foreground font-medium disabled:cursor-not-allowed disabled:opacity-45'
            }`}
          >
            {option.badge ? (
              <>
                <span className="min-w-0 truncate">{option.label}</span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-bold uppercase tracking-normal ${
                    option.value === value
                      ? 'border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground'
                      : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300'
                  }`}
                >
                  {option.badge}
                </span>
              </>
            ) : option.label}
          </Button>
        ))}
      </AnchoredPopover>
    </div>
  )
}
