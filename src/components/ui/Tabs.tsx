import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
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

  const list = (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex min-w-max items-center select-none',
        variant === 'underline' ? 'gap-3 border-b border-border/40 sm:gap-5' : 'gap-1 rounded-xl border border-border/70 bg-background p-1',
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
            variant={variant === 'segmented' && active ? 'secondary' : 'tertiary'}
            size="sm"
            role="tab"
            aria-selected={active}
            aria-controls={active ? option.panelId : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={event => onKeyDown(event, index)}
            className={cn(
              'relative shrink-0',
              variant === 'underline' && 'rounded-none border-x-0 border-t-0 px-1.5 pb-3 shadow-none',
              variant === 'underline' && active && 'text-accent-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
              variant === 'underline' && !active && 'text-muted-foreground',
            )}
          >
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
