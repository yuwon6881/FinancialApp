import { useRef, type KeyboardEvent } from 'react'
import { ChartPie, ShieldCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Tabs } from '../ui/Tabs'

import { SETTINGS_TABS_BY_SCOPE, type SettingsScope, type SettingsTabId } from './settingsScopes'


interface SettingsTabsProps {
  scope?: SettingsScope
  activeTab: SettingsTabId
  onChange: (tab: SettingsTabId) => void
  /** The two-pane layout: sections as a list down the side instead of tabs across the top. */
  vertical?: boolean
}

const SECTION_DETAILS: Partial<Record<SettingsTabId, { Icon: LucideIcon; hint: string }>> = {
  'financial-model': { Icon: SlidersHorizontal, hint: 'Appearance and alerts' },
  'investment-plan': { Icon: ChartPie, hint: 'Target mix and classifications' },
  security: { Icon: ShieldCheck, hint: 'Devices, sign-in and passkeys' },
}

export function SettingsTabs({ scope = 'settings', activeTab, onChange, vertical = false }: SettingsTabsProps) {
  const tabs = SETTINGS_TABS_BY_SCOPE[scope]
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  if (tabs.length < 2) return null
  const label = scope === 'budget' ? 'Budget sections' : 'Settings sections'

  if (!vertical) {
    return (
      <Tabs
        value={activeTab}
        onValueChange={onChange}
        options={tabs.map(([value, tabLabel]) => ({ value, label: tabLabel, panelId: `settings-panel-${value}` }))}
        label={label}
        idPrefix="settings-tab"
        scrollable
      />
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next][0])
    window.requestAnimationFrame(() => refs.current[next]?.focus({ preventScroll: true }))
  }

  return (
    <nav aria-label={label} className="sticky top-6">
      <div role="tablist" aria-label={label} aria-orientation="vertical" className="flex flex-col gap-1">
        {tabs.map(([value, tabLabel], index) => {
          const active = value === activeTab
          const details = SECTION_DETAILS[value]
          const Icon = details?.Icon
          return (
            <Button
              key={value}
              ref={node => { refs.current[index] = node }}
              id={`settings-tab-${value}`}
              variant="tertiary"
              role="tab"
              aria-selected={active}
              aria-controls={active ? `settings-panel-${value}` : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(value)}
              onKeyDown={event => onKeyDown(event, index)}
              className={cn(
                'h-auto w-full justify-start gap-3 rounded-control px-3 py-2.5 text-left lg:min-h-0',
                active ? 'bg-surface-2 text-foreground hover:bg-surface-2 dark:bg-surface-3 dark:hover:bg-surface-3' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon && (
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', active ? 'bg-card text-accent-ink dark:bg-surface-2' : 'bg-surface-2 dark:bg-surface-3')}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0">
                <span className={cn('block text-body', active ? 'font-semibold' : 'font-medium')}>{tabLabel}</span>
                {details && <span className="block truncate text-caption font-normal text-muted-foreground">{details.hint}</span>}
              </span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
