import { Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface AskAiButtonProps {
  /** The visible words, e.g. "Explain this cycle". */
  label: string
  /** The full accessible name, e.g. "Explain this cycle with Ask AI". */
  ariaLabel?: string
  onClick: () => void
  disabled?: boolean
  title?: string
  /**
   * `auto` (the default) folds to a round icon button below 640px, where a page header has no
   * room for the words; `full` always shows them, for a button in a card's own action row.
   */
  collapse?: 'auto' | 'full'
  className?: string
}

/**
 * The one way a page offers to explain itself with Ask AI. It wears the Iris tint the sidebar's
 * Ask AI entry already uses, so "this opens the assistant" reads the same on every page instead of
 * looking like one more grey secondary action.
 */
export function AskAiButton({ label, ariaLabel, onClick, disabled, title, collapse = 'auto', className }: AskAiButtonProps) {
  return (
    <Button
      variant="tertiary"
      size="sm"
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? label}
      className={cn(
        'shrink-0 gap-1.5 border-primary/15 bg-primary/8 font-medium text-accent-ink hover:border-primary/30 hover:bg-primary/14 dark:bg-primary/12 dark:hover:bg-primary/20',
        collapse === 'auto' && 'size-11 p-0 sm:size-auto sm:px-3.5',
        className,
      )}
    >
      <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
      <span className={cn(collapse === 'auto' && 'hidden sm:inline')}>{label}</span>
    </Button>
  )
}
