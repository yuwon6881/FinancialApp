import type { ReactNode } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import type { Transaction } from '../../types'
import { Button } from '../ui/Button'

interface DraftReorderItemProps {
  value: Transaction
  position: number
  count: number
  disabled: boolean
  onMove: (direction: -1 | 1) => void
  children: (grip: ReactNode) => ReactNode
}

export function DraftReorderItem({
  value,
  position,
  count,
  disabled,
  onMove,
  children,
}: DraftReorderItemProps) {
  const controls = useDragControls()
  const reduceMotion = useReducedMotion()

  const grip = (
    <Button size="icon"
      variant="tertiary"
      type="button"
      aria-label={`Reorder ${value.description}. Position ${position} of ${count}. Use Up or Down arrow keys.`}
      aria-keyshortcuts="ArrowUp ArrowDown"
      onPointerDown={event => {
        event.stopPropagation()
        controls.start(event)
      }}
      onKeyDown={event => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
        event.preventDefault()
        onMove(event.key === 'ArrowUp' ? -1 : 1)
      }}
      disabled={disabled}
      className="mt-0.5 inline-flex size-11 shrink-0 touch-none cursor-grab items-center justify-center gap-0.5 self-start rounded-xl border border-border/60 bg-muted/35 text-muted-foreground transition hover:border-primary/30 hover:bg-muted/60 hover:text-foreground active:cursor-grabbing sm:size-9"
    >
      <span className="text-caption font-extrabold tabular-nums" aria-hidden="true">{position}</span>
      <GripVertical className="size-3.5 opacity-60" aria-hidden="true" />
    </Button>
  )

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
      whileDrag={reduceMotion ? undefined : { scale: 1.015, boxShadow: 'var(--app-shadow)' }}
      className="relative z-0 w-full list-none rounded-2xl focus-within:z-10"
    >
      {children(grip)}
    </Reorder.Item>
  )
}
