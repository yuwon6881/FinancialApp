import React, { useRef, type KeyboardEvent } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Button } from '../ui/Button'

export type RecurringTabId = 'recurring' | 'loans'

interface RecurringTabsProps {
  activeTab: RecurringTabId
  onChange: (tab: RecurringTabId) => void
  recurringCount: number
  loansCount: number
}

interface TabOption {
  id: RecurringTabId
  label: string
  count: number
}

export const RecurringTabs: React.FC<RecurringTabsProps> = ({
  activeTab,
  onChange,
  recurringCount,
  loansCount,
}) => {
  const reduceMotion = useReducedMotion()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const tabs: TabOption[] = [
    { id: 'recurring', label: 'Recurring Bills', count: recurringCount },
    { id: 'loans', label: 'Loans', count: loansCount },
  ]

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1

    if (nextIndex === null) return
    event.preventDefault()
    onChange(tabs[nextIndex].id)
    window.requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus({ preventScroll: true }))
  }

  return (
    <div
      role="tablist"
      aria-label="Recurring view sections"
      className="flex items-center gap-4 border-b border-border/30 pb-1 select-none"
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id

        return (
          <Button
            variant="unstyled"
            key={tab.id}
            ref={element => { tabRefs.current[index] = element }}
            id={`recurring-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`recurring-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`relative flex min-h-11 items-center gap-2 px-1 pb-3 text-xs font-bold transition sm:min-h-0 ${
              isActive ? 'font-extrabold text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold transition-colors ${
                isActive ? 'bg-primary/15 text-accent-ink' : 'bg-muted/80 text-muted-foreground'
              }`}
            >
              {tab.count}
            </span>
            {isActive && (
              <m.span
                layoutId="activeRecurringTabLine"
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
