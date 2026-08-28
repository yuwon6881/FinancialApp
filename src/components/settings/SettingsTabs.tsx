import { useRef, type KeyboardEvent } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Button } from '../ui/Button'
import { HorizontalRail } from '../ui/HorizontalRail'

export type SettingsTabId = 'financial-model' | 'investment-plan' | 'categories-preferences' | 'accounts' | 'security'

const SETTINGS_TABS: ReadonlyArray<readonly [SettingsTabId, string]> = [
  ['financial-model', 'Plan & Preferences'],
  ['investment-plan', 'Investment Plan'],
  ['categories-preferences', 'Categories & Limits'],
  ['accounts', 'Accounts'],
  ['security', 'Security & Devices'],
]

interface SettingsTabsProps {
  activeTab: SettingsTabId
  onChange: (tab: SettingsTabId) => void
}

export function SettingsTabs({ activeTab, onChange }: SettingsTabsProps) {
  const reduceMotion = useReducedMotion()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % SETTINGS_TABS.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = SETTINGS_TABS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    onChange(SETTINGS_TABS[nextIndex][0])
    window.requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus({ preventScroll: true }))
  }

  return (
    <HorizontalRail label="Settings sections" showControls className="p-0 scroll-px-0">
      <div role="tablist" aria-label="Settings sections" className="flex min-w-max gap-3 border-b border-border/30 px-1 select-none sm:gap-6">
        {SETTINGS_TABS.map(([id, label], index) => (
        <Button
          variant="unstyled"
          key={id}
          ref={element => { tabRefs.current[index] = element }}
          id={`settings-tab-${id}`}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          aria-controls={activeTab === id ? `settings-panel-${id}` : undefined}
          tabIndex={activeTab === id ? 0 : -1}
          onClick={() => onChange(id)}
          onKeyDown={event => handleKeyDown(event, index)}
          className={`relative flex min-h-11 shrink-0 cursor-pointer items-end px-1.5 pb-3 text-left text-xs font-bold transition sm:px-1 sm:text-center ${
            activeTab === id ? 'font-extrabold text-accent-ink' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="min-w-0 leading-tight">{label}</span>
          {activeTab === id && (
            <m.span
              layoutId="activeSettingsTabLine"
              className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </Button>
        ))}
      </div>
    </HorizontalRail>
  )
}
