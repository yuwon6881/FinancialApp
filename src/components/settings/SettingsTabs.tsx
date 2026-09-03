import { Tabs } from '../ui/Tabs'

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
  return (
    <Tabs
      value={activeTab}
      onValueChange={onChange}
      options={SETTINGS_TABS.map(([value, label]) => ({ value, label, panelId: `settings-panel-${value}` }))}
      label="Settings sections"
      idPrefix="settings-tab"
      scrollable
    />
  )
}
