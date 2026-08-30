import React from 'react'
import { Button } from '../ui/Button'
import type { AppTab } from '../../types'
import type { AppNavigationOptions } from '../../lib/appLocation'
import { APP_LOCATION_CHANGED_EVENT } from '../../lib/appLocation'
import {
  CalendarCheck2,
  BarChart3,
  Wallet,
  Landmark,
  CreditCard,
  Receipt,
  TrendingUp,
  FileText,
  Settings,
} from 'lucide-react'
import { CommitmentIcon, RewardIcon } from '../semanticIcons'

export interface DesktopNavItem {
  id: string
  tab: AppTab
  section?: string
  search?: Record<string, string | number | boolean | null | undefined>
  label: string
  Icon: React.ComponentType<{ className?: string }>
  activeClass: string
  iconClass: string
  dotClass: string
}

export interface DesktopNavGroup {
  id: string
  label: string
  items: DesktopNavItem[]
}

interface DesktopNavRailProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab, options?: AppNavigationOptions) => void
}

const DESKTOP_NAV_GROUPS: DesktopNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        id: 'today',
        tab: 'dashboard',
        label: 'Today',
        Icon: CalendarCheck2,
        activeClass: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25 shadow-blue-500/10',
        iconClass: 'text-blue-500',
        dotClass: 'bg-blue-500',
      },
      {
        id: 'reports',
        tab: 'reports',
        label: 'Reports',
        Icon: BarChart3,
        activeClass: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 shadow-indigo-500/10',
        iconClass: 'text-indigo-500',
        dotClass: 'bg-indigo-500',
      },
    ],
  },
  {
    id: 'cash-expenses',
    label: 'Cash & Expenses',
    items: [
      {
        id: 'ledger',
        tab: 'ledger',
        label: 'Ledger',
        Icon: Wallet,
        activeClass: 'bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/25 shadow-teal-500/10',
        iconClass: 'text-teal-500',
        dotClass: 'bg-teal-500',
      },
      {
        id: 'accounts',
        tab: 'settings',
        section: 'accounts',
        search: { section: 'accounts' },
        label: 'Accounts',
        Icon: Landmark,
        activeClass: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 border-cyan-500/25 shadow-cyan-500/10',
        iconClass: 'text-cyan-500',
        dotClass: 'bg-cyan-500',
      },
      {
        id: 'recurring-bills',
        tab: 'recurring',
        section: 'recurring',
        search: { section: 'recurring' },
        label: 'Recurring Bills',
        Icon: CreditCard,
        activeClass: 'bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/25 shadow-violet-500/10',
        iconClass: 'text-violet-500',
        dotClass: 'bg-violet-500',
      },
      {
        id: 'loans',
        tab: 'recurring',
        section: 'loans',
        search: { section: 'loans' },
        label: 'Loans',
        Icon: Receipt,
        activeClass: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25 shadow-amber-500/10',
        iconClass: 'text-amber-500',
        dotClass: 'bg-amber-500',
      },
    ],
  },
  {
    id: 'wealth-goals',
    label: 'Wealth & Goals',
    items: [
      {
        id: 'investments',
        tab: 'investments',
        label: 'Investments',
        Icon: TrendingUp,
        activeClass: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 shadow-emerald-500/10',
        iconClass: 'text-emerald-500',
        dotClass: 'bg-emerald-500',
      },
      {
        id: 'commitments',
        tab: 'wishlist',
        section: 'commitments',
        search: { section: 'commitments' },
        label: 'Commitments',
        Icon: CommitmentIcon,
        activeClass: 'bg-purple-500/12 text-purple-600 dark:text-purple-400 border-purple-500/25 shadow-purple-500/10',
        iconClass: 'text-purple-500',
        dotClass: 'bg-purple-500',
      },
      {
        id: 'rewards',
        tab: 'wishlist',
        section: 'rewards',
        search: { section: 'rewards' },
        label: 'Rewards',
        Icon: RewardIcon,
        activeClass: 'bg-pink-500/12 text-pink-600 dark:text-pink-400 border-pink-500/25 shadow-pink-500/10',
        iconClass: 'text-pink-500',
        dotClass: 'bg-pink-500',
      },
      {
        id: 'documents',
        tab: 'documents',
        label: 'Vault',
        Icon: FileText,
        activeClass: 'bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/25 shadow-orange-500/10',
        iconClass: 'text-orange-500',
        dotClass: 'bg-orange-500',
      },
    ],
  },
]

const FOOTER_ITEMS: DesktopNavItem[] = [
  {
    id: 'settings',
    tab: 'settings',
    section: 'model',
    search: { section: 'model' },
    label: 'Settings',
    Icon: Settings,
    activeClass: 'bg-slate-500/12 text-slate-600 dark:text-slate-400 border-slate-500/25 shadow-slate-500/10',
    iconClass: 'text-slate-500',
    dotClass: 'bg-slate-500',
  },
]

function isItemActive(item: DesktopNavItem, activeTab: AppTab, locationSearch: string, locationHash: string): boolean {
  if (item.tab !== activeTab) return false

  if (item.tab === 'recurring') {
    const isLoans = locationSearch.includes('loan') || locationHash.includes('loan') || locationSearch.includes('section=loans')
    if (item.section === 'loans') return isLoans
    if (item.section === 'recurring') return !isLoans
    return !isLoans
  }

  if (item.tab === 'wishlist') {
    const isRewards = locationSearch.includes('reward') || locationHash.includes('reward') || locationSearch.includes('section=rewards')
    if (item.section === 'rewards') return isRewards
    if (item.section === 'commitments') return !isRewards
    return !isRewards
  }

  if (item.tab === 'settings') {
    const isAccounts = locationSearch.includes('account') || locationHash.includes('account') || locationSearch.includes('section=accounts')
    if (item.section === 'accounts') return isAccounts
    if (item.section === 'model' || !item.section) return !isAccounts
    return !isAccounts
  }

  return true
}

export const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  activeTab,
  onTabChange,
}) => {
  const [locationSearch, setLocationSearch] = React.useState(() => typeof window !== 'undefined' ? window.location.search : '')
  const [locationHash, setLocationHash] = React.useState(() => typeof window !== 'undefined' ? window.location.hash : '')

  React.useEffect(() => {
    const handleLocationChange = () => {
      setLocationSearch(window.location.search)
      setLocationHash(window.location.hash)
    }
    window.addEventListener(APP_LOCATION_CHANGED_EVENT, handleLocationChange)
    window.addEventListener('popstate', handleLocationChange)
    return () => {
      window.removeEventListener(APP_LOCATION_CHANGED_EVENT, handleLocationChange)
      window.removeEventListener('popstate', handleLocationChange)
    }
  }, [])

  const renderItem = (item: DesktopNavItem) => {
    const { id, label, Icon, activeClass, iconClass, dotClass } = item
    const isActive = isItemActive(item, activeTab, locationSearch, locationHash)

    return (
      <Button
        key={id}
        variant="unstyled"
        type="button"
        title={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onTabChange(item.tab, item.search ? { search: item.search } : undefined)}
        className={`group relative flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border px-2 text-body font-semibold transition duration-150 lg:justify-start lg:pl-3.5 lg:pr-2.5 ${
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

  return (
    <aside className="glass-rail fixed inset-y-0 left-0 z-40 hidden w-20 border-r border-border/30 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] backdrop-blur-xl sm:block lg:w-56">
      <nav aria-label="Primary" className="flex h-full flex-col overflow-y-auto px-2 py-3 lg:px-2.5">
        {DESKTOP_NAV_GROUPS.map((group, index) => (
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

        {FOOTER_ITEMS.length > 0 && (
          <div className="mt-auto flex flex-col gap-1 border-t border-border/25 pt-4">
            {FOOTER_ITEMS.map(renderItem)}
          </div>
        )}
      </nav>
    </aside>
  )
}
