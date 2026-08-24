import React from 'react'
import { Button } from '../ui/Button'
import { triggerHaptic } from '../../lib/haptics'
import type { AppTab } from '../../types'

export interface NavItemConfig {
  tab: AppTab
  label: string
  mobileLabel: string
  Icon: React.ComponentType<{ className?: string }>
  activeClass: string
  iconClass: string
  dotClass: string
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/88 backdrop-blur-xl select-none shadow-[var(--app-shadow-nav-up)] transform-gpu"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', paddingTop: '10px', willChange: 'transform' }}
    >
      <nav aria-label="Primary" className="grid grid-cols-5 w-full max-w-md md:max-w-none px-2 md:px-8 mx-auto justify-items-center">
        {navItems.map(({ tab, mobileLabel, Icon, activeClass, iconClass, dotClass }) => {
          const isActive = activeTab === tab
          return (
            <Button variant="unstyled"
              key={tab}
              onClick={() => { triggerHaptic(8); onTabChange(tab) }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-w-0 flex-col items-center gap-1 text-[11px] font-semibold cursor-pointer transition-all duration-200 w-full text-center ${
                isActive ? 'scale-[1.03] font-bold text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`relative flex size-9 items-center justify-center rounded-xl border transition-all duration-200 ${
                isActive ? `${activeClass} shadow-sm` : 'border-transparent bg-transparent'
              }`}>
                <Icon className={`size-4.5 mx-auto ${isActive ? iconClass : 'text-muted-foreground'}`} />
                {isActive && <span className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${dotClass} ring-1 ring-background`} />}
              </span>
              <span className="truncate max-w-full px-0.5">{mobileLabel}</span>
            </Button>
          )
        })}
      </nav>
    </div>
  )
}
