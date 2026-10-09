import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { m } from 'framer-motion'
import { cn } from '../../lib/utils'
import { SPRING } from '../../lib/animations'
import { Badge } from './Badge'
import { Button } from './Button'
import { HorizontalRail } from './HorizontalRail'

export interface TabOption<T extends string> {
  value: T
  label: ReactNode
  count?: number
  panelId?: string
}

interface TabsProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: readonly TabOption<T>[]
  label: string
  idPrefix: string
  /**
   * `underline` is page-level navigation between sibling views; `segmented` is a compact switch
   * between two to four modes of the same content. Both slide their selection marker between
   * options rather than snapping, so the eye follows the change.
   */
  variant?: 'underline' | 'segmented'
  scrollable?: boolean
  className?: string
}

export function Tabs<T extends string>({
  value,
  onValueChange,
  options,
  label,
  idPrefix,
  variant = 'underline',
  scrollable = false,
  className,
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = options.length - 1
    if (next === null) return
    event.preventDefault()
    onValueChange(options[next].value)
    window.requestAnimationFrame(() => refs.current[next]?.focus({ preventScroll: true }))
  }

  const segmented = variant === 'segmented'

  const list = (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex min-w-max items-center select-none',
        segmented
          ? 'gap-0.5 rounded-full bg-surface-2 p-1 dark:bg-surface-2'
          : 'gap-1 border-b border-border/70 sm:gap-2',
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <Button
            key={option.value}
            ref={node => { refs.current[index] = node }}
            id={`${idPrefix}-${option.value}`}
            variant="tertiary"
            size="sm"
            role="tab"
            aria-selected={active}
            aria-controls={active ? option.panelId : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={event => onKeyDown(event, index)}
            className={cn(
              'relative shrink-0 isolate',
              segmented
                ? cn('px-3.5 hover:bg-transparent', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
                : cn(
                  'rounded-none border-x-0 border-t-0 px-2.5 pb-3 hover:bg-transparent',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                ),
            )}
          >
            {active && (
              <m.span
                aria-hidden="true"
                layoutId={`${idPrefix}-tab-marker`}
                transition={SPRING.snappy}
                className={cn(
                  'pointer-events-none absolute -z-10',
                  segmented
                    ? 'inset-0 rounded-full bg-card shadow-xs ring-1 ring-border/60 dark:bg-surface-3 dark:ring-0'
                    : 'inset-x-1.5 -bottom-px h-0.5 rounded-full bg-primary',
                )}
              />
            )}
            {option.label}
            {option.count !== undefined && <Badge tone={active ? 'accent' : 'neutral'}>{option.count}</Badge>}
          </Button>
        )
      })}
    </div>
  )

  return scrollable
    ? <HorizontalRail label={label} showControls className="p-0 scroll-px-0">{list}</HorizontalRail>
    : list
}
