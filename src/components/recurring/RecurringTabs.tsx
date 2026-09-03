import React from 'react'
import { Tabs } from '../ui/Tabs'

export type RecurringTabId = 'recurring' | 'loans'

interface RecurringTabsProps {
  activeTab: RecurringTabId
  onChange: (tab: RecurringTabId) => void
  recurringCount: number
  loansCount?: number
}

interface TabOption {
  id: RecurringTabId
  label: string
  count?: number
}

export const RecurringTabs: React.FC<RecurringTabsProps> = ({
  activeTab,
  onChange,
  recurringCount,
  loansCount,
}) => {
  const tabs: TabOption[] = [
    { id: 'recurring', label: 'Recurring Bills', count: recurringCount },
    { id: 'loans', label: 'Loans', count: loansCount },
  ]

  return (
    <Tabs
      value={activeTab}
      onValueChange={onChange}
      options={tabs.map(tab => ({ value: tab.id, label: tab.label, count: tab.count, panelId: `recurring-panel-${tab.id}` }))}
      label="Recurring view sections"
      idPrefix="recurring-tab"
    />
  )
}
