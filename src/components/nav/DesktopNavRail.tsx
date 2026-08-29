import React from 'react'
import { Button } from '../ui/Button'
import type { AppTab } from '../../types'
import type { NavItemConfig } from './MobileBottomNav'

interface DesktopNavRailProps {
  navItems: NavItemConfig[]
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}

export const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  navItems,
  activeTab,
  onTabChange,
}) => (
  <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 border-r border-border/40 bg-background/88 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] backdrop-blur-xl sm:block lg:w-56">
    <nav aria-label="Primary" className="flex h-full flex-col justify-center gap-1 overflow-y-auto px-2 py-3 lg:px-2.5">
      {navItems.map(({ tab, label, Icon, activeClass, iconClass, dotClass }) => {
        const isActive = tab === activeTab
        return (
          <Button
            key={tab}
            variant="unstyled"
            type="button"
            title={label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onTabChange(tab)}
            className={`relative flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border px-2 text-body font-semibold transition duration-150 lg:justify-start lg:px-2.5 ${
              isActive
                ? `${activeClass} font-bold shadow-sm`
                : 'border-transparent text-muted-foreground hover:bg-muted/45 hover:text-foreground'
            }`}
          >
            {isActive && <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full ${dotClass}`} />}
            <Icon className={`size-4.5 shrink-0 ${isActive ? iconClass : 'text-muted-foreground'}`} />
            <span className="hidden truncate lg:inline">{label}</span>
          </Button>
        )
      })}
    </nav>
  </aside>
)
