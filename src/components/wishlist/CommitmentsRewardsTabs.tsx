import React from 'react'
import { Tabs } from '../ui/Tabs'

export type CommitmentsRewardsTabId = 'commitments' | 'rewards'

interface CommitmentsRewardsTabsProps {
  activeTab: CommitmentsRewardsTabId
  onChange: (tab: CommitmentsRewardsTabId) => void
  commitmentsCount: number
  rewardsCount: number
}

interface SectionOption {
  id: CommitmentsRewardsTabId
  label: string
  count: number
}

export const CommitmentsRewardsTabs: React.FC<CommitmentsRewardsTabsProps> = ({
  activeTab,
  onChange,
  commitmentsCount,
  rewardsCount,
}) => {
  const allSections: SectionOption[] = [
    { id: 'commitments', label: 'Commitments', count: commitmentsCount },
    { id: 'rewards', label: 'Rewards', count: rewardsCount },
  ]
  return (
    <Tabs
      value={activeTab}
      onValueChange={onChange}
      options={allSections.map(section => ({ value: section.id, label: section.label, count: section.count, panelId: `commitments-rewards-panel-${section.id}` }))}
      label="Commitments and rewards sections"
      idPrefix="commitments-rewards-tab"
      className="grid min-w-0 grid-cols-2 sm:flex sm:min-w-max"
    />
  )
}
