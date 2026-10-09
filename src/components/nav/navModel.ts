import type { ComponentType } from 'react'
import { ArrowLeftRight, ChartPie, ChartSpline, House, Landmark } from 'lucide-react'
import type { AppTab } from '../../types'
import { isLoansLocation } from '../../lib/appLocation'

/**
 * The five Lumen destinations. Every tab belongs to exactly one, except Settings, which is a
 * utility reached from the profile menu and the sidebar footer rather than a place you browse.
 */
export type DestinationId = 'today' | 'activity' | 'plan' | 'wealth' | 'insights'

export interface HubSection {
  id: string
  label: string
  tab: AppTab
  /** Extra search the section is addressed by (Loans shares the Recurring tab). */
  search?: Record<string, string | null>
}

export interface Destination {
  id: DestinationId
  label: string
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>
  tabs: readonly AppTab[]
  /** Sub-sections shown as a segmented row at the top of the destination. */
  sections?: readonly HubSection[]
}

export const DESTINATIONS: readonly Destination[] = [
  { id: 'today', label: 'Today', Icon: House, tabs: ['dashboard'] },
  {
    id: 'activity',
    label: 'Activity',
    Icon: ArrowLeftRight,
    tabs: ['ledger', 'drafts'],
    sections: [
      { id: 'transactions', label: 'Transactions', tab: 'ledger' },
      { id: 'review', label: 'Review', tab: 'drafts' },
    ],
  },
  {
    id: 'plan',
    label: 'Plan',
    Icon: ChartPie,
    tabs: ['budget', 'recurring', 'wishlist'],
    sections: [
      { id: 'budget', label: 'Budget', tab: 'budget' },
      { id: 'bills', label: 'Bills', tab: 'recurring', search: { section: 'recurring', loan: null } },
      { id: 'loans', label: 'Loans', tab: 'recurring', search: { section: 'loans', subscription: null } },
      { id: 'goals', label: 'Goals', tab: 'wishlist' },
    ],
  },
  {
    id: 'wealth',
    label: 'Wealth',
    Icon: Landmark,
    tabs: ['accounts', 'investments', 'documents'],
    sections: [
      { id: 'accounts', label: 'Accounts', tab: 'accounts' },
      { id: 'investments', label: 'Investments', tab: 'investments' },
      { id: 'vault', label: 'Vault', tab: 'documents' },
    ],
  },
  { id: 'insights', label: 'Insights', Icon: ChartSpline, tabs: ['reports'] },
] as const

export function destinationForTab(tab: AppTab): Destination | null {
  return DESTINATIONS.find(destination => destination.tabs.includes(tab)) ?? null
}

/** Which sub-section of a destination the current address shows. */
export function activeSectionId(destination: Destination, tab: AppTab, pathname: string, search: string): string | null {
  const sections = destination.sections
  if (!sections) return null
  if (tab === 'recurring') return isLoansLocation(pathname, search) ? 'loans' : 'bills'
  return sections.find(section => section.tab === tab)?.id ?? null
}

/** The tab a destination opens on: the last section visited this session, else its first. */
const LAST_SECTION_KEY = 'lumen:last-section:'

export function rememberSection(destination: DestinationId, sectionId: string) {
  try {
    sessionStorage.setItem(LAST_SECTION_KEY + destination, sectionId)
  } catch {
    // Storage can be unavailable; the destination then opens on its first section.
  }
}

export function landingSection(destination: Destination): HubSection | null {
  if (!destination.sections) return null
  let remembered: string | null = null
  try {
    remembered = sessionStorage.getItem(LAST_SECTION_KEY + destination.id)
  } catch {
    remembered = null
  }
  return destination.sections.find(section => section.id === remembered) ?? destination.sections[0]
}
