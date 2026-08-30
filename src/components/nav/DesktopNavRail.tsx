import React from 'react'
import { Button } from '../ui/Button'
import type { AppTab } from '../../types'
import type { NavItemConfig } from './MobileBottomNav'

interface DesktopNavRailProps {
  navItems: NavItemConfig[]
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}

/**
 * Destinations grouped by what the user is there to do. The rail is as tall as the viewport but
 * the nine destinations are not, so a single flat list had to choose between floating in the
 * middle (detached from the header it belongs to) or leaving one large empty block. Grouping
 * anchors the list under the header, spends the extra height on structure instead of padding,
 * and lets Settings sit at the foot of the rail where utility destinations are looked for.
 *
 * Order inside a group follows `navItems`, and any destination this map does not name still
 * renders (in the trailing group), so adding a tab in TopNav can never make it disappear here.
 */
const NAV_GROUPS: { id: string; label: string; tabs: AppTab[] }[] = [
  { id: 'overview', label: 'Overview', tabs: ['dashboard', 'reports'] },
  { id: 'money', label: 'Money', tabs: ['ledger', 'recurring', 'investments'] },
  { id: 'planning', label: 'Planning', tabs: ['wishlist', 'documents'] },
]

/** Pinned to the foot of the rail rather than listed with the destinations above. */
const FOOTER_TABS: AppTab[] = ['settings']

export const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  navItems,
  activeTab,
  onTabChange,
}) => {
  const byTab = new Map(navItems.map(item => [item.tab, item]))
  const placed = new Set<AppTab>([...NAV_GROUPS.flatMap(group => group.tabs), ...FOOTER_TABS])

  const renderItem = ({ tab, label, Icon, activeClass, iconClass, dotClass }: NavItemConfig) => {
    const isActive = tab === activeTab
    return (
      <Button
        key={tab}
        variant="unstyled"
        type="button"
        title={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onTabChange(tab)}
        className={`relative flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border px-2 text-body font-semibold transition duration-150 lg:justify-start lg:pl-3.5 lg:pr-2.5 ${
          isActive
            ? `${activeClass} font-bold shadow-sm`
            : 'border-transparent text-muted-foreground hover:bg-primary/5 hover:text-foreground'
        }`}
      >
        {isActive && <span className={`absolute left-1.5 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full ${dotClass}`} />}
        <Icon className={`size-4.5 shrink-0 transition-transform duration-150 ${isActive ? iconClass : 'text-muted-foreground group-hover:scale-105'}`} />
        <span className="hidden truncate lg:inline">{label}</span>
      </Button>
    )
  }

  const groups = NAV_GROUPS
    .map(group => ({ ...group, items: group.tabs.map(tab => byTab.get(tab)).filter((item): item is NavItemConfig => !!item) }))
    .filter(group => group.items.length > 0)

  const ungrouped = navItems.filter(item => !placed.has(item.tab))
  if (ungrouped.length > 0) {
    groups.push({ id: 'more', label: 'More', tabs: ungrouped.map(item => item.tab), items: ungrouped })
  }

  const footerItems = FOOTER_TABS
    .map(tab => byTab.get(tab))
    .filter((item): item is NavItemConfig => !!item)

  return (
    <aside className="glass-rail fixed inset-y-0 left-0 z-40 hidden w-20 border-r border-border/30 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] backdrop-blur-xl sm:block lg:w-56">
      <nav aria-label="Primary" className="flex h-full flex-col overflow-y-auto px-2 py-3 lg:px-2.5">
        {groups.map((group, index) => (
          <div key={group.id} role="group" aria-label={group.label} className={index > 0 ? 'mt-2' : undefined}>
            {/* The written label carries the grouping on the expanded rail; the icon-only rail has
                no room for words, so a rule carries it there instead. Both are decorative — the
                group's accessible name comes from aria-label above. */}
            {index > 0 && <div aria-hidden="true" className="mx-2 mb-2 h-px bg-border/50 lg:hidden" />}
            <div aria-hidden="true" className="hidden px-2.5 pb-1.5 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground/80 lg:block">
              {group.label}
            </div>
            <div className="flex flex-col gap-1">
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}

        {footerItems.length > 0 && (
          <div className="mt-auto flex flex-col gap-1 border-t border-border/25 pt-4">
            {footerItems.map(renderItem)}
          </div>
        )}
      </nav>
    </aside>
  )
}
