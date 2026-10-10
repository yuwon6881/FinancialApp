import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { CollapsibleBody } from './CollapsibleBody'
import { Panel } from './Panel'

interface DisclosurePanelProps {
  /** A bare 20px icon; it carries the section's status colour where it has one. */
  icon: ReactNode
  title: ReactNode
  /** Short trailing status beside the chevron, e.g. "Enabled" or a count. */
  status?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/**
 * A panel whose header opens and closes its body. The header is the full width of the panel and
 * square-cornered inside a clipped, rounded panel, so its hover fill meets the panel's own corners
 * instead of drawing a pill inside it; it does not take the button press scale, which would pull
 * the fill away from the edges. The body has the same inset as the header on every side, below a
 * hairline, so nothing in it touches the divider.
 */
export function DisclosurePanel({
  icon,
  title,
  status,
  open,
  onToggle,
  children,
  className,
  bodyClassName,
}: DisclosurePanelProps) {
  return (
    <Panel as="section" padding="none" className={cn('overflow-hidden', className)}>
      <Button
        variant="tertiary"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="min-h-16 w-full justify-start gap-3 rounded-none px-5 py-4 text-left hover:bg-surface-2/70 active:scale-100 focus-visible:-outline-offset-2"
      >
        <span className="flex size-5 shrink-0 items-center justify-center [&_svg]:size-5">{icon}</span>
        <h3 className="min-w-0 flex-1 truncate text-subsection text-foreground">{title}</h3>
        {status != null && <span className="shrink-0 text-label">{status}</span>}
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-fluid', open && 'rotate-180')}
        />
      </Button>
      <CollapsibleBody open={open}>
        <div className={cn('space-y-4 border-t border-border/60 p-5', bodyClassName)}>{children}</div>
      </CollapsibleBody>
    </Panel>
  )
}
