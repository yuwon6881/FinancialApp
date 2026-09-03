import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './Button'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnchoredPopover } from './AnchoredPopover'
import { cn } from '../../lib/utils'
import { controlTriggerClassName, type ControlSize } from './controlStyles'
import { useFormFieldControlProps } from './formFieldControl'

export interface DatePickerProps {
  /** Value as an ISO date string (YYYY-MM-DD) or '' when unset. */
  value: string
  onChange: (value: string) => void
  className?: string
  align?: 'left' | 'right'
  invalid?: boolean
  placeholder?: string
  id?: string
  min?: string
  max?: string
  popoverClassName?: string
  clearable?: boolean
  clearAriaLabel?: string
  disabled?: boolean
  required?: boolean
  controlSize?: ControlSize
  'aria-describedby'?: string
  ariaLabel?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const PANEL_WIDTH = 272

function parseISO(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (
    date.getFullYear() !== Number(match[1])
    || date.getMonth() !== Number(match[2]) - 1
    || date.getDate() !== Number(match[3])
  ) return null
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dateToISO(date: Date) {
  return toISO(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDisplay(value: string): string | null {
  const parsed = parseISO(value)
  if (!parsed) return null
  return `${MONTHS[parsed.month].slice(0, 3)} ${parsed.day}, ${parsed.year}`
}

function formatAccessibleDate(value: string) {
  const parsed = parseISO(value)
  if (!parsed) return value
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(parsed.year, parsed.month, parsed.day))
}

function clampISO(value: string, min?: string, max?: string) {
  if (min && value < min) return min
  if (max && value > max) return max
  return value
}

export function DatePicker({
  value,
  onChange,
  className,
  align = 'left',
  invalid = false,
  placeholder = 'Select date',
  id,
  min,
  max,
  popoverClassName,
  clearable = false,
  clearAriaLabel = 'Clear date',
  disabled = false,
  required = false,
  controlSize = 'md',
  'aria-describedby': ariaDescribedBy,
  ariaLabel = 'Choose date',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef(new Map<string, HTMLButtonElement>())
  const dialogId = useId()
  const now = new Date()
  const todayISO = dateToISO(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayISO = dateToISO(yesterday)
  const initialISO = clampISO(value || todayISO, min, max)
  const initialParsed = parseISO(initialISO) ?? {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
  }
  const [viewDate, setViewDate] = useState({
    year: initialParsed.year,
    month: initialParsed.month,
  })
  const [activeISO, setActiveISO] = useState(initialISO)
  const accessibleProps = useFormFieldControlProps({
    id,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': invalid || undefined,
    'aria-required': required || undefined,
  })
  const isInvalid = accessibleProps['aria-invalid'] === true
    || accessibleProps['aria-invalid'] === 'true'

  const close = (restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const open = () => {
    if (disabled) return
    const nextISO = clampISO(value || todayISO, min, max)
    const next = parseISO(nextISO) ?? initialParsed
    setActiveISO(nextISO)
    setViewDate({ year: next.year, month: next.month })
    setIsOpen(true)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target)
        && panelRef.current && !panelRef.current.contains(target)
      ) close()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (disabled) close()
  }, [disabled])

  useEffect(() => {
    if (!isOpen) return
    const frame = window.requestAnimationFrame(() => dayRefs.current.get(activeISO)?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [activeISO, isOpen, viewDate])

  const display = formatDisplay(value)
  const firstWeekday = new Date(viewDate.year, viewDate.month, 1).getDay()
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  const setActiveDate = (date: Date) => {
    const nextISO = clampISO(dateToISO(date), min, max)
    const next = parseISO(nextISO)
    if (!next) return
    setActiveISO(nextISO)
    setViewDate({ year: next.year, month: next.month })
  }

  const moveActiveByDays = (days: number) => {
    const active = parseISO(activeISO) ?? initialParsed
    const next = new Date(active.year, active.month, active.day + days)
    setActiveDate(next)
  }

  const moveActiveByMonths = (months: number) => {
    const active = parseISO(activeISO) ?? initialParsed
    const next = new Date(active.year, active.month + months, active.day)
    setActiveDate(next)
  }

  const select = (iso: string) => {
    if ((min && iso < min) || (max && iso > max)) return
    onChange(iso)
    close(true)
  }

  const goToMonth = (delta: number) => {
    const next = new Date(viewDate.year, viewDate.month + delta, 1)
    const active = parseISO(activeISO)
    const day = Math.min(active?.day ?? 1, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())
    setActiveDate(new Date(next.getFullYear(), next.getMonth(), day))
  }

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <div
        className={cn(
          controlTriggerClassName({ size: controlSize, invalid: isInvalid }),
          'gap-0 p-0 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
          isInvalid && 'focus-within:border-destructive focus-within:ring-destructive/25',
        )}
      >
        <Button variant="tertiary"
          ref={triggerRef}
          type="button"
          id={accessibleProps.id}
          disabled={disabled}
          onClick={() => isOpen ? close() : open()}
          aria-label={display ? `${ariaLabel}: ${display}` : ariaLabel}
          aria-labelledby={accessibleProps['aria-labelledby']}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={dialogId}
          aria-describedby={accessibleProps['aria-describedby']}
          aria-invalid={accessibleProps['aria-invalid']}
          aria-required={accessibleProps['aria-required']}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-[inherit] px-3.5 text-left outline-none disabled:cursor-not-allowed"
        >
          <span className={cn('truncate', !display && 'font-medium text-muted-foreground')}>
            {display ?? placeholder}
          </span>
          <Calendar className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden="true" />
        </Button>
        {clearable && value && (
          <Button variant="tertiary"
            type="button"
            disabled={disabled}
            aria-label={clearAriaLabel}
            onClick={() => {
              onChange('')
              close()
              triggerRef.current?.focus()
            }}
            className="mr-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      <AnchoredPopover
        ref={panelRef}
        id={dialogId}
        open={isOpen}
        anchorRef={triggerRef}
        align={align}
        side="bottom"
        role="dialog"
        aria-label={ariaLabel}
        style={{ width: PANEL_WIDTH }}
        className={cn(
          'z-[210] overflow-y-auto overscroll-contain rounded-xl border border-border',
          'bg-popover p-3 text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-100',
          popoverClassName,
        )}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close(true)
          }
        }}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <Button variant="tertiary"
            type="button"
            onClick={() => goToMonth(-1)}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span aria-live="polite" className="text-xs font-bold text-foreground select-none">
            {MONTHS[viewDate.month]} {viewDate.year}
          </span>
          <Button variant="tertiary"
            type="button"
            onClick={() => goToMonth(1)}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div role="grid" aria-label={`${MONTHS[viewDate.month]} ${viewDate.year}`}>
          <div role="row" className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map(label => (
              <span
                key={label}
                role="columnheader"
                aria-label={label}
                className="flex h-7 items-center justify-center text-xs font-bold uppercase tracking-wider text-muted-foreground select-none"
              >
                {label}
              </span>
            ))}
          </div>
          <div role="rowgroup" className="grid grid-cols-7 gap-0.5">
            {cells.map((day, index) => {
              if (day === null) return <span role="presentation" key={`empty-${index}`} />
              const cellISO = toISO(viewDate.year, viewDate.month, day)
              const isSelected = cellISO === value
              const isActive = cellISO === activeISO
              const isToday = cellISO === todayISO
              const isDisabled = Boolean((min && cellISO < min) || (max && cellISO > max))

              return (
                <Button variant="tertiary"
                  key={cellISO}
                  ref={node => {
                    if (node) dayRefs.current.set(cellISO, node)
                    else dayRefs.current.delete(cellISO)
                  }}
                  type="button"
                  role="gridcell"
                  aria-label={formatAccessibleDate(cellISO)}
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  disabled={isDisabled}
                  tabIndex={isActive ? 0 : -1}
                  onFocus={() => setActiveISO(cellISO)}
                  onClick={() => select(cellISO)}
                  onKeyDown={event => {
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      moveActiveByDays(-1)
                    } else if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      moveActiveByDays(1)
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      moveActiveByDays(-7)
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      moveActiveByDays(7)
                    } else if (event.key === 'Home') {
                      event.preventDefault()
                      const active = parseISO(activeISO)
                      if (active) moveActiveByDays(-new Date(active.year, active.month, active.day).getDay())
                    } else if (event.key === 'End') {
                      event.preventDefault()
                      const active = parseISO(activeISO)
                      if (active) moveActiveByDays(6 - new Date(active.year, active.month, active.day).getDay())
                    } else if (event.key === 'PageUp') {
                      event.preventDefault()
                      moveActiveByMonths(-1)
                    } else if (event.key === 'PageDown') {
                      event.preventDefault()
                      moveActiveByMonths(1)
                    } else if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      select(cellISO)
                    }
                  }}
                  className={cn(
                    // Seven global 44px targets cannot fit the fixed calendar panel; the grid
                    // supplies spacing and keyboard navigation while each cell stays contained.
                    'flex h-8 !min-h-8 !min-w-0 cursor-pointer items-center justify-center rounded-lg text-xs transition duration-100',
                    isDisabled && 'cursor-not-allowed text-muted-foreground/35',
                    !isDisabled && isSelected && 'bg-primary font-bold text-primary-foreground shadow-xs',
                    !isDisabled && !isSelected && isToday
                      && 'font-bold text-blue-600 hover:bg-muted/80 dark:text-blue-400',
                    !isDisabled && !isSelected && !isToday
                      && 'font-medium text-foreground hover:bg-muted/80',
                    isActive && 'outline-2 outline-offset-1 outline-ring',
                  )}
                >
                  {day}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="mt-2.5 flex justify-end gap-1 border-t border-border/40 pt-2.5">
          <Button variant="tertiary"
            type="button"
            disabled={Boolean((min && yesterdayISO < min) || (max && yesterdayISO > max))}
            onClick={() => select(yesterdayISO)}
            className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Yesterday
          </Button>
          <Button variant="tertiary"
            type="button"
            disabled={Boolean((min && todayISO < min) || (max && todayISO > max))}
            onClick={() => select(todayISO)}
            className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold text-blue-600 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-400"
          >
            Today
          </Button>
        </div>
      </AnchoredPopover>
    </div>
  )
}
