import React from 'react'
import { Button } from '../ui/Button'
import { triggerHaptic } from '../../lib/haptics'
import type { AppTab } from '../../types'

export interface NavItemConfig {
  tab: AppTab
  label: string
  mobileLabel: string
  Icon: React.ComponentType<{ className?: string }>
  activeClass?: string
  iconClass: string
  dotClass?: string
}

export interface MobileBottomNavProps {
  navItems: NavItemConfig[]
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  navItems,
  activeTab,
  onTabChange,
}) => {
  return (
    <div
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-background/80 backdrop-blur-2xl select-none shadow-[var(--app-shadow-nav-up)] transform-gpu"
      style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', paddingTop: '8px', willChange: 'transform' }}
    >
      <nav
        aria-label="Primary"
        className="mx-auto grid w-full max-w-md justify-items-center px-1.5"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map(({ tab, mobileLabel, Icon, iconClass }) => {
          const isActive = activeTab === tab
          return (
            <Button variant="tertiary"
              key={tab}
              onClick={() => { triggerHaptic(8); onTabChange(tab) }}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex min-w-0 flex-col items-center gap-1 px-1 text-caption cursor-pointer transition-all duration-200 w-full text-center active:scale-95 ${
                isActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`relative flex size-8 items-center justify-center rounded-xl transition-all duration-200 ${
                isActive ? 'bg-foreground/6 text-foreground scale-105' : 'text-muted-foreground'
              }`}>
                <Icon className={`size-4.5 mx-auto transition-colors duration-200 ${isActive ? iconClass : 'text-muted-foreground'}`} />
              </span>
              <span className={`truncate max-w-full px-0.5 text-caption tracking-tight transition-colors duration-200 ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{mobileLabel}</span>
            </Button>
          )
        })}
      </nav>
    </div>
  )
}
