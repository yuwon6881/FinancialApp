import React from 'react'
import { m } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { SPRING } from '../../lib/animations'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/utils'
import type { AppTab } from '../../types'
import { DESTINATIONS, destinationForTab, type Destination } from './navModel'

export interface TabBarProps {
  activeTab: AppTab
  onSelectDestination: (destination: Destination) => void
  onQuickAdd: () => void
  quickAddOpen?: boolean
  quickAddTriggerRef?: React.Ref<HTMLButtonElement>
  draftCount?: number
}

/**
 * The phone tab bar: a floating glass capsule holding the five destinations, with the add action
 * as its own circle beside it rather than squeezed in as a sixth tab. The selection pill slides
 * between tabs, and the whole bar sits above the home indicator.
 */
export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onSelectDestination,
  onQuickAdd,
  quickAddOpen = false,
  quickAddTriggerRef,
  draftCount = 0,
}) => {
  const active = destinationForTab(activeTab)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 select-none sm:hidden"
      style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-md items-center gap-2 px-3">
        <nav
          aria-label="Primary"
          className="glass-surface pointer-events-auto flex min-w-0 flex-1 items-stretch rounded-full p-1 shadow-(--app-shadow-nav-up)"
        >
          {DESTINATIONS.map(destination => {
            const isActive = active?.id === destination.id
            const badge = destination.id === 'activity' && draftCount > 0 ? draftCount : 0
            return (
              <Button
                key={destination.id}
                variant="tertiary"
                type="button"
                aria-current={isActive ? 'page' : undefined}
                aria-label={badge ? `${destination.label}, ${badge} to review` : destination.label}
                onClick={() => { triggerHaptic(8); onSelectDestination(destination) }}
                className={cn(
                  'relative isolate h-13 min-w-0 flex-1 flex-col gap-0.5 rounded-full px-0 hover:bg-transparent',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {isActive && (
                  <m.span
                    layoutId="tabbar-active"
                    transition={SPRING.snappy}
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-full bg-foreground/8 dark:bg-foreground/10"
                  />
                )}
                <span className="relative">
                  <destination.Icon className={cn('size-5', isActive && 'text-accent-ink')} strokeWidth={isActive ? 2.1 : 1.8} />
                  {badge > 0 && (
                    <span aria-hidden="true" className="absolute -right-1.5 -top-1 size-2 rounded-full bg-primary ring-2 ring-card" />
                  )}
                </span>
                <span className={cn('max-w-full truncate px-0.5 text-micro', isActive ? 'font-semibold' : 'font-medium')}>{destination.label}</span>
              </Button>
            )
          })}
        </nav>
        <Button
          ref={quickAddTriggerRef}
          size="icon"
          type="button"
          aria-label={quickAddOpen ? 'Close quick add' : 'Quick add'}
          aria-expanded={quickAddOpen}
          aria-haspopup="dialog"
          onClick={() => { triggerHaptic(10); onQuickAdd() }}
          className="pointer-events-auto size-15 shrink-0 bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
        >
          <Plus className={cn('size-6 transition-transform duration-200 ease-fluid', quickAddOpen && 'rotate-45')} strokeWidth={2.25} />
        </Button>
      </div>
    </div>
  )
}
