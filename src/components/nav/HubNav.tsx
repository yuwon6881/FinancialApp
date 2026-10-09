import React from 'react'
import { m } from 'framer-motion'
import { Button } from '../ui/Button'
import { SPRING } from '../../lib/animations'
import { cn } from '../../lib/utils'
import type { Destination, HubSection } from './navModel'

interface HubNavProps {
  destination: Destination
  activeSectionId: string | null
  onSelect: (section: HubSection) => void
  /** Per-section counts, e.g. drafts waiting in Review. */
  counts?: Partial<Record<string, number>>
  /** Sections to leave out, e.g. Review while there is nothing to review. */
  hidden?: readonly string[]
  className?: string
}

/**
 * The segmented row at the top of a destination with sections: Budget · Bills · Loans · Goals,
 * Accounts · Investments · Vault. These are places, not panels of one page, so it is a `nav` of
 * buttons marked with `aria-current` rather than a tablist. It scrolls sideways on a narrow phone.
 */
export const HubNav: React.FC<HubNavProps> = ({ destination, activeSectionId, onSelect, counts, hidden, className }) => {
  const sections = (destination.sections ?? []).filter(section => !hidden?.includes(section.id))
  if (sections.length < 2) return null
  return (
    <nav aria-label={`${destination.label} sections`} className={cn('-mx-4 min-w-0 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0', className)}>
      <div className="inline-flex items-center gap-0.5 rounded-full bg-surface-2 p-1 dark:bg-surface-2">
        {sections.map(section => {
          const active = section.id === activeSectionId
          const count = counts?.[section.id]
          return (
            <Button
              key={section.id}
              variant="tertiary"
              size="sm"
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(section)}
              className={cn(
                'relative isolate shrink-0 px-4 hover:bg-transparent',
                active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <m.span
                  layoutId={`hub-${destination.id}`}
                  transition={SPRING.snappy}
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-card shadow-xs ring-1 ring-border/60 dark:bg-surface-3 dark:ring-0"
                />
              )}
              {section.label}
              {count ? (
                <span className="min-w-5 rounded-full bg-primary/14 px-1.5 text-center text-caption font-semibold text-accent-ink">{count}</span>
              ) : null}
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
