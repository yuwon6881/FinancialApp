import React, { useRef, type KeyboardEvent } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Button } from '../ui/Button'

export type CommitmentsRewardsTabId = 'commitments' | 'rewards'

interface CommitmentsRewardsTabsProps {
  activeTab: CommitmentsRewardsTabId
  onChange: (tab: CommitmentsRewardsTabId) => void
  commitmentsCount: number
  rewardsCount: number
}

interface SectionOption {
  id: CommitmentsRewardsTabId
  label: string
  count: number
}

export const CommitmentsRewardsTabs: React.FC<CommitmentsRewardsTabsProps> = ({
  activeTab,
  onChange,
  commitmentsCount,
  rewardsCount,
}) => {
  const reduceMotion = useReducedMotion()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const allSections: SectionOption[] = [
    { id: 'commitments', label: 'Commitments', count: commitmentsCount },
    { id: 'rewards', label: 'Rewards', count: rewardsCount },
  ]
  const sections = allSections

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
      aria-label="Commitments and rewards sections"
      className="grid grid-cols-2 gap-0 border-b border-border/30 pb-1 select-none sm:flex sm:items-center sm:gap-4"
    >
      {sections.map((section, index) => {
        const isActive = activeTab === section.id

        return (
          <Button
            variant="unstyled"
            key={section.id}
            ref={element => { tabRefs.current[index] = element }}
            id={`commitments-rewards-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`commitments-rewards-panel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(section.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`relative flex min-h-11 w-full items-center justify-center gap-2 px-1 pb-3 text-xs font-bold transition sm:min-h-0 sm:w-auto sm:justify-start ${
              isActive ? 'font-extrabold text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{section.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold transition-colors ${
                isActive ? 'bg-primary/15 text-accent-ink' : 'bg-muted/80 text-muted-foreground'
              }`}
            >
              {section.count}
            </span>
            {isActive && (
              <m.span
                layoutId="activeCommitmentsRewardsTabLine"
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </Button>
        )
      })}
    </div>
  )
}
