import { Tabs } from '../ui/Tabs'

import { SETTINGS_TABS_BY_SCOPE, type SettingsScope, type SettingsTabId } from './settingsScopes'

export type { SettingsScope, SettingsTabId }

interface SettingsTabsProps {
  scope?: SettingsScope
  activeTab: SettingsTabId
  onChange: (tab: SettingsTabId) => void
}

export function SettingsTabs({ scope = 'settings', activeTab, onChange }: SettingsTabsProps) {
  const tabs = SETTINGS_TABS_BY_SCOPE[scope]
  if (tabs.length < 2) return null
  return (
    <Tabs
      value={activeTab}
      onValueChange={onChange}
      options={tabs.map(([value, label]) => ({ value, label, panelId: `settings-panel-${value}` }))}
      label={scope === 'budget' ? 'Budget sections' : 'Settings sections'}
      idPrefix="settings-tab"
      scrollable
    />
  )
}
