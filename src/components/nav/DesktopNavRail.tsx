import React from 'react'
import { Button } from '../ui/Button'
import type { AppTab } from '../../types'
import type { AppNavigationOptions } from '../../lib/appLocation'
import { APP_LOCATION_CHANGED_EVENT } from '../../lib/appLocation'
import { getCurrentCycleYearAndMonth, getCycleProgress } from '../../lib/cycle'
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
}

export interface DesktopNavGroup {
  id: string
  label: string
  items: DesktopNavItem[]
}

interface DesktopNavRailProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab, options?: AppNavigationOptions) => void
  /** Configured cycle start day. Absent until the dashboard settings load, in which
      case the rail simply omits the cycle block rather than guessing a cadence. */
  cycleDay?: number
}

const DESKTOP_NAV_GROUPS: DesktopNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'today', tab: 'dashboard', label: 'Today', Icon: CalendarCheck2 },
      { id: 'reports', tab: 'reports', label: 'Reports', Icon: BarChart3 },
    ],
  },
  {
    id: 'cash-expenses',
    label: 'Cash & Expenses',
    items: [
      { id: 'ledger', tab: 'ledger', label: 'Ledger', Icon: Wallet },
      {
        id: 'accounts',
        tab: 'settings',
        section: 'accounts',
        search: { section: 'accounts' },
        label: 'Accounts',
        Icon: Landmark,
      },
      {
        id: 'recurring-bills',
        tab: 'recurring',
        section: 'recurring',
        search: { section: 'recurring' },
        label: 'Recurring Bills',
        Icon: CreditCard,
      },
      {
        id: 'loans',
        tab: 'recurring',
        section: 'loans',
        search: { section: 'loans' },
        label: 'Loans',
        Icon: Receipt,
      },
    ],
  },
  {
    id: 'wealth-goals',
    label: 'Wealth & Goals',
    items: [
      { id: 'investments', tab: 'investments', label: 'Investments', Icon: TrendingUp },
      {
        id: 'commitments',
        tab: 'wishlist',
        section: 'commitments',
        search: { section: 'commitments' },
        label: 'Commitments',
        Icon: CommitmentIcon,
      },
      {
        id: 'rewards',
        tab: 'wishlist',
        section: 'rewards',
        search: { section: 'rewards' },
        label: 'Rewards',
        Icon: RewardIcon,
      },
      { id: 'documents', tab: 'documents', label: 'Vault', Icon: FileText },
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

/** Cycle position, shown only on the expanded rail — the collapsed rail has no room for
    a figure and a bar, and a bar with no numbers beside it explains nothing. */
const CycleBlock: React.FC<{ cycleDay: number }> = ({ cycleDay }) => {
  const progress = React.useMemo(() => {
    const { year, monthIndex } = getCurrentCycleYearAndMonth(cycleDay)
    return getCycleProgress(year, monthIndex, cycleDay)
  }, [cycleDay])

  const headline = progress.phase === 'upcoming'
    ? `Starts in ${progress.daysUntilStart} ${progress.daysUntilStart === 1 ? 'day' : 'days'}`
    : `Day ${progress.dayNumber} of ${progress.totalDays}`
  const detail = progress.phase === 'ended'
    ? 'Cycle closed'
    : progress.phase === 'upcoming'
      ? `${progress.totalDays} days long`
      : `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left`

  return (
    <div className="mb-3 hidden rounded-xl border border-primary/25 bg-linear-to-br from-primary/12 to-primary/4 px-3 py-2.5 lg:block">
      <p className="text-[0.625rem] font-bold uppercase tracking-widest text-accent-ink/85">This cycle</p>
      <p className="mt-1 text-body font-bold tabular-nums text-foreground">{headline}</p>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-label="Cycle progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.progressPct)}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress.progressPct))}%` }} />
      </div>
      <p className="mt-1.5 text-caption font-medium text-muted-foreground">{detail}</p>
    </div>
  )
}

export const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  activeTab,
  onTabChange,
  cycleDay,
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
    const { id, label, Icon } = item
    const isActive = isItemActive(item, activeTab, locationSearch, locationHash)

    return (
      <Button
        key={id}
        variant="unstyled"
        type="button"
        title={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onTabChange(item.tab, item.search ? { search: item.search } : undefined)}
        className={`group relative flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl px-1.5 text-body transition-colors duration-150 lg:min-h-9 lg:justify-start lg:px-2 ${
          isActive
            ? 'bg-muted font-bold text-foreground shadow-[inset_0_1px_0_var(--app-inner-highlight)]'
            : 'font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        }`}
      >
        {/* One accent carries the active state: the icon tile fills gold. It survives the
            collapsed rail, where a label cannot, so the cue never depends on the words. */}
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
            isActive
              ? 'bg-primary text-primary-foreground ring-1 ring-primary/40'
              : 'bg-foreground/6 text-muted-foreground group-hover:bg-foreground/10 group-hover:text-foreground'
          }`}
        >
          <Icon className="size-4" />
        </span>
        <span className="hidden truncate lg:inline">{label}</span>
      </Button>
    )
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 px-2 pb-2 pt-[calc(4.25rem+env(safe-area-inset-top,0px))] sm:block lg:w-56 lg:px-2.5 lg:pb-2.5">
      <nav
        aria-label="Primary"
        className="app-panel flex h-full flex-col overflow-y-auto rounded-2xl border border-border/60 bg-card/80 px-2 py-3 lg:px-2.5"
      >
        {cycleDay !== undefined && <CycleBlock cycleDay={cycleDay} />}

        {DESKTOP_NAV_GROUPS.map((group, index) => (
          <div key={group.id} role="group" aria-label={group.label} className={index > 0 ? 'mt-4' : undefined}>
            {/* The written label carries the grouping on the expanded rail; the icon-only rail has
                no room for words, so a rule carries it there instead. Both are decorative — the
                group's accessible name comes from aria-label above. */}
            {index > 0 && <div aria-hidden="true" className="mx-2 mb-3 h-px bg-border/60 lg:hidden" />}
            <div aria-hidden="true" className="hidden px-2 pb-1.5 text-[0.625rem] font-bold uppercase tracking-widest text-muted-foreground/70 lg:block">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}

        {FOOTER_ITEMS.length > 0 && (
          <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-3">
            {FOOTER_ITEMS.map(renderItem)}
          </div>
        )}
      </nav>
    </aside>
  )
}
