import { useRef, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

export interface RecapStep {
  id: string
  title: string
  node: ReactNode
}

interface RecapStoryProps {
  steps: RecapStep[]
  step: number
  onStepChange: (step: number) => void
}

const SWIPE_THRESHOLD = 48

/**
 * The cycle recap told a chapter at a time. Segments along the top say where you are and jump to
 * any chapter; Back and Next, the arrow keys and a sideways swipe move one at a time.
 */
export function RecapStory({ steps, step, onStepChange }: RecapStoryProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const current = steps[step]
  const isFirst = step === 0
  const isLast = step === steps.length - 1
  const go = (next: number) => onStepChange(Math.max(0, Math.min(steps.length - 1, next)))

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [role="combobox"]')) return
    if (event.key === 'ArrowRight') { event.preventDefault(); go(step + 1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(step - 1) }
  }
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Only a clearly sideways swipe turns the page; a scroll that drifts stays a scroll.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return
    go(step + (dx < 0 ? 1 : -1))
  }

  return (
    <div onKeyDown={onKeyDown} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="text-sm leading-relaxed">
      <div className="flex gap-1" aria-label="Recap chapters" role="group">
        {steps.map((item, index) => (
          <Button
            key={item.id}
            variant="tertiary"
            onClick={() => go(index)}
            aria-label={`Chapter ${index + 1}: ${item.title}`}
            aria-current={index === step ? 'step' : undefined}
            className="h-6 min-h-0 flex-1 rounded-full p-0 hover:bg-transparent lg:min-h-0"
          >
            <span className={cn('h-1 w-full rounded-full transition-colors', index <= step ? 'bg-foreground' : 'bg-foreground/15')} />
          </Button>
        ))}
      </div>

      <section aria-labelledby={`recap-step-${current.id}`} className="mt-3">
        <p className="text-caption text-muted-foreground tabular-nums">{step + 1} of {steps.length}</p>
        <h3 id={`recap-step-${current.id}`} className="text-title text-foreground">{current.title}</h3>
        <div key={current.id} className="mt-4 animate-in fade-in duration-200">
          {current.node}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <Button variant="secondary" size="sm" onClick={() => go(step - 1)} disabled={isFirst}>
          <ChevronLeft className="size-4" aria-hidden="true" /> Back
        </Button>
        {!isLast && (
          <Button variant="primary" size="sm" onClick={() => go(step + 1)}>
            {steps[step + 1].title} <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}
