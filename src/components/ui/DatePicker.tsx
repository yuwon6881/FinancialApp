import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  /** Value as an ISO date string (YYYY-MM-DD) or '' when unset. */
  value: string
  onChange: (value: string) => void
  className?: string
  align?: 'left' | 'right'
  error?: boolean
  placeholder?: string
  id?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const PANEL_WIDTH = 272 // 17rem
const PANEL_HEIGHT = 340 // approximate, used only for flip decision

// Parse a YYYY-MM-DD string into local y/m/d parts (no timezone shift).
function parseISO(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
}

function toISO(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function formatDisplay(value: string): string | null {
  const parsed = parseISO(value)
  if (!parsed) return null
  return `${MONTHS[parsed.month].slice(0, 3)} ${parsed.day}, ${parsed.year}`
}

export function DatePicker({
  value,
  onChange,
  className = '',
  align = 'left',
  error = false,
  placeholder = 'Select date',
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const parsed = parseISO(value)

  // The month currently shown in the calendar grid. Seeded from the value,
  // falling back to today when unset.
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return parsed
      ? { year: parsed.year, month: parsed.month }
      : { year: now.getFullYear(), month: now.getMonth() }
  })

  // Position the floating panel relative to the trigger, flipping upward when
  // there isn't enough room below. Rendered in a portal so it is never clipped
  // by an ancestor's overflow.
  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = align === 'right' ? rect.right - PANEL_WIDTH : rect.left
    left = Math.min(Math.max(left, 8), vw - PANEL_WIDTH - 8)

    const openUp = rect.bottom + PANEL_HEIGHT > vh && rect.top > vh - rect.bottom
    const top = openUp ? rect.top - PANEL_HEIGHT - 6 : rect.bottom + 6

    setCoords({ top, left })
  }

  useLayoutEffect(() => {
    if (!isOpen) return
    if (parsed) setViewDate({ year: parsed.year, month: parsed.month })
    updatePosition()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [isOpen])

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

  const display = formatDisplay(value)

  const firstWeekday = new Date(viewDate.year, viewDate.month, 1).getDay()
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate()

  const today = new Date()
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate())

  const goToMonth = (delta: number) => {
    setViewDate(prev => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const selectDay = (day: number) => {
    onChange(toISO(viewDate.year, viewDate.month, day))
    setIsOpen(false)
  }

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full h-10 flex items-center justify-between gap-2 px-2.5 sm:px-3.5 text-xs bg-background border rounded-xl font-semibold shadow-xs hover:bg-muted/30 transition duration-150 cursor-pointer text-left select-none focus:outline-none focus:ring-1 text-foreground ${
          error ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-blue-500'
        }`}
      >
        <span className={`truncate ${display ? '' : 'text-muted-foreground font-medium'}`}>
          {display ?? placeholder}
        </span>
        <Calendar className="size-3.5 text-muted-foreground/80 shrink-0" />
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: PANEL_WIDTH }}
          className="bg-card dark:bg-slate-900 border border-border rounded-xl shadow-xl p-3 z-[200] animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Month / year header */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground transition cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold text-foreground select-none">
              {MONTHS[viewDate.month]} {viewDate.year}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground transition cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map(label => (
              <span
                key={label}
                className="flex items-center justify-center h-7 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 select-none"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} />
              const cellISO = toISO(viewDate.year, viewDate.month, day)
              const isSelected = cellISO === value
              const isToday = cellISO === todayISO
              return (
                <button
                  key={cellISO}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex items-center justify-center h-8 text-xs rounded-lg transition duration-100 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : isToday
                      ? 'font-bold text-blue-600 dark:text-blue-400 hover:bg-muted/80'
                      : 'font-medium text-foreground hover:bg-muted/80'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick action */}
          <div className="mt-2.5 pt-2.5 border-t border-border/40 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onChange(todayISO)
                setIsOpen(false)
              }}
              className="px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg transition cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
