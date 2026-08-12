import React, { useRef, type KeyboardEvent } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Button } from '../ui/Button'
import { Flag, Sparkles, Trophy } from 'lucide-react'

export type WishlistSectionId = 'all' | 'commitments' | 'rewards'

interface WishlistSectionToggleProps {
  activeSection: WishlistSectionId
  onChange: (section: WishlistSectionId) => void
  commitmentsCount: number
  rewardsCount: number
}

interface SectionOption {
  id: WishlistSectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

export const WishlistSectionToggle: React.FC<WishlistSectionToggleProps> = ({
  activeSection,
  onChange,
  commitmentsCount,
  rewardsCount,
}) => {
  const reduceMotion = useReducedMotion()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const totalCount = commitmentsCount + rewardsCount

  const sections: SectionOption[] = [
    { id: 'all', label: 'All', icon: Sparkles, count: totalCount },
    { id: 'commitments', label: 'Commitments', icon: Flag, count: commitmentsCount },
    { id: 'rewards', label: 'Rewards', icon: Trophy, count: rewardsCount },
  ]

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % sections.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + sections.length) % sections.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = sections.length - 1

    if (nextIndex === null) return
    event.preventDefault()
    onChange(sections[nextIndex].id)
    window.requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus({ preventScroll: true }))
  }

  return (
    <div
      role="tablist"
      aria-label="Wishlist sections view"
      className="inline-flex w-full items-center justify-between gap-1 rounded-xl border border-border/60 bg-card/92 p-1 select-none sm:w-auto"
    >
      {sections.map((section, index) => {
        const Icon = section.icon
        const isActive = activeSection === section.id

        return (
          <Button
            variant="unstyled"
            key={section.id}
            ref={element => { tabRefs.current[index] = element }}
            id={`wishlist-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`wishlist-panel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(section.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:min-h-9 sm:flex-initial ${
              isActive
                ? 'font-extrabold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className={`size-3.5 ${isActive ? 'text-accent-ink' : 'text-muted-foreground/70'}`} />
            <span>{section.label}</span>
            {typeof section.count === 'number' && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-accent-ink'
                    : 'bg-muted/80 text-muted-foreground'
                }`}
              >
                {section.count}
              </span>
            )}
            {isActive && (
              <m.span
                layoutId="activeWishlistSectionPill"
                className="absolute inset-0 -z-10 rounded-lg bg-muted/80 shadow-xs"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
          </Button>
        )
      })}
    </div>
  )
}
