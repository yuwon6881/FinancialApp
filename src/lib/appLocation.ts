import { APP_TABS, type AppTab } from '../types'
import type { TransactionLinkFilter, TransactionSearchMode } from './transactionFilters'

export type LedgerRouteRange = 'monthly' | '3month' | '6month' | 'yearly' | 'all'
type LedgerRouteTxType = 'inflow' | 'outflow' | 'transfer' | null

export interface LedgerRouteState {
  filters: string[]
  search: string
  searchMode: TransactionSearchMode
  startDate: string
  endDate: string
  minAmount: string
  maxAmount: string
  recurringFilter: TransactionLinkFilter
  wishlistFilter: TransactionLinkFilter
  txType: LedgerRouteTxType
  showAllCycles: boolean
  range: LedgerRouteRange
  highlightedTxId: string | null
}

export interface AppLocationState {
  tab: AppTab
  month: string
  year: number
  ledger: LedgerRouteState
  destination: {
    recurringPaymentId: string | null
    loanId: string | null
    reportSection: string | null
    reportCategory: string | null
    accountId: string | null
    commitmentId: string | null
    rewardId: string | null
    draftId: string | null
  }
}

export interface AppNavigationOptions {
  replace?: boolean
  search?: Record<string, string | number | boolean | null | undefined>
}

export const APP_CONTEXT_WILL_CHANGE_EVENT = 'financial-app:context-will-change'

const PATH_BY_TAB: Record<AppTab, string> = {
  dashboard: '/dashboard',
  reports: '/reports',
  recurring: '/recurring',
  ledger: '/ledger',
  wishlist: '/commitments-rewards',
  drafts: '/drafts',
  settings: '/settings',
  investments: '/investments',
  documents: '/vault',
}

const TAB_BY_PATH = Object.fromEntries(
  Object.entries(PATH_BY_TAB).map(([tab, path]) => [path, tab]),
) as Record<string, AppTab>
TAB_BY_PATH['/wishlist'] = 'wishlist'

const LEDGER_PARAM_KEYS = [
  'filters',
  'q',
  'match',
  'from',
  'to',
  'min',
  'max',
  'recurring',
  'wishlist',
  'type',
  'all',
  'range',
  'tx',
] as const

const MONTHS = new Set(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
const RANGES = new Set<LedgerRouteRange>(['monthly', '3month', '6month', 'yearly', 'all'])
const TX_TYPES = new Set<Exclude<LedgerRouteTxType, null>>(['inflow', 'outflow', 'transfer'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const parseLedgerDate = (value: string | null): string => {
  if (!value || !ISO_DATE.test(value)) return ''
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? '' : value
}

const parseLedgerAmount = (value: string | null): string => {
  const normalized = value?.trim() ?? ''
  if (!normalized) return ''
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? normalized : ''
}

const parseLinkFilter = (value: string | null): TransactionLinkFilter => {
  if (value === 'exclude') return 'exclude'
  // `1` is the URL format used before this became a three-state filter.
  if (value === 'only' || value === '1') return 'only'
  return 'all'
}

const emptyLedgerRouteState = (): LedgerRouteState => ({
  filters: [],
  search: '',
  searchMode: 'contains',
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  recurringFilter: 'all',
  wishlistFilter: 'all',
  txType: null,
  showAllCycles: false,
  range: 'monthly',
  highlightedTxId: null,
})

const parseTab = (pathname: string, params: URLSearchParams): AppTab => {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  const pathTab = TAB_BY_PATH[normalizedPath]
  if (pathTab) return pathTab
  const legacyView = params.get('view')
  return APP_TABS.includes(legacyView as AppTab) ? (legacyView as AppTab) : 'dashboard'
}

export const readAppLocation = (): AppLocationState => {
  if (typeof window === 'undefined') {
    return {
      tab: 'dashboard', month: '', year: 0, ledger: emptyLedgerRouteState(),
      destination: {
        recurringPaymentId: null, loanId: null, reportSection: null, reportCategory: null,
        accountId: null, commitmentId: null, rewardId: null, draftId: null,
      },
    }
  }

  const params = new URLSearchParams(window.location.search)
  const rawMonth = params.get('month') || ''
  const rawYear = Number(params.get('year') || 0)
  const rawRange = params.get('range') as LedgerRouteRange | null
  const range = params.get('all') === '1' && (!rawRange || rawRange === 'monthly') ? 'all' : rawRange
  const txType = params.get('type') as Exclude<LedgerRouteTxType, null> | null

  return {
    tab: parseTab(window.location.pathname, params),
    month: MONTHS.has(rawMonth) ? rawMonth : '',
    year: Number.isInteger(rawYear) && rawYear >= 1900 && rawYear <= 2200 ? rawYear : 0,
    ledger: {
      filters: (params.get('filters') || '').split(',').map(value => value.trim()).filter(Boolean),
      search: params.get('q') || '',
      searchMode: params.get('match') === 'exact' || params.get('match') === 'whole-word' ? 'exact' : 'contains',
      startDate: parseLedgerDate(params.get('from')),
      endDate: parseLedgerDate(params.get('to')),
      minAmount: parseLedgerAmount(params.get('min')),
      maxAmount: parseLedgerAmount(params.get('max')),
      recurringFilter: parseLinkFilter(params.get('recurring')),
      wishlistFilter: parseLinkFilter(params.get('wishlist')),
      txType: txType && TX_TYPES.has(txType) ? txType : null,
      showAllCycles: params.get('all') === '1',
      range: range && RANGES.has(range) ? range : 'monthly',
      highlightedTxId: params.get('tx'),
    },
    destination: {
      recurringPaymentId: params.get('subscription'),
      loanId: params.get('loan'),
      reportSection: params.get('focus'),
      reportCategory: params.get('focusCategory'),
      accountId: params.get('account'),
      commitmentId: params.get('commitment'),
      rewardId: params.get('reward'),
      draftId: params.get('draft'),
    },
  }
}

const applySearchUpdates = (
  params: URLSearchParams,
  updates: Record<string, string | number | boolean | null | undefined>,
) => {
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '' || value === false) {
      params.delete(key)
    } else {
      params.set(key, value === true ? '1' : String(value))
    }
  })
}

const writeUrl = (pathname: string, params: URLSearchParams, replace: boolean) => {
  if (typeof window === 'undefined') return
  params.delete('view')
  const query = params.toString()
  const nextUrl = `${pathname}${query ? `?${query}` : ''}`
  const currentUrl = `${window.location.pathname}${window.location.search}`
  if (nextUrl === currentUrl) return
  const currentParams = new URLSearchParams(window.location.search)
  const contextWillChange = pathname !== window.location.pathname
    || params.get('month') !== currentParams.get('month')
    || params.get('year') !== currentParams.get('year')

  if (contextWillChange) {
    window.dispatchEvent(new Event(APP_CONTEXT_WILL_CHANGE_EVENT))
  }

  // A BottomSheet leaves a sentinel on the history stack so browser Back can
  // dismiss it. App navigation must consume that sentinel instead of pushing
  // a route above it, or revisiting Back/Forward can resurrect the old sheet.
  const replaceModalEntry = contextWillChange && Boolean(window.history.state?.modalId)
  window.history[replace || replaceModalEntry ? 'replaceState' : 'pushState']({}, '', nextUrl)
}

export const navigateToAppTab = (tab: AppTab, options: AppNavigationOptions = {}) => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (tab !== 'ledger') LEDGER_PARAM_KEYS.forEach(key => params.delete(key))
  if (tab !== 'recurring') {
    params.delete('subscription')
    params.delete('loan')
  }
  // `focus` scrolls Reports to one section and `focusCategory` can target a card inside it.
  // Deliberately not named `section`, which Settings already owns for its own deep links.
  if (tab !== 'reports') {
    params.delete('focus')
    params.delete('focusCategory')
  }
  if (tab !== 'settings') params.delete('account')
  if (tab !== 'wishlist') {
    params.delete('commitment')
    params.delete('reward')
  }
  if (tab !== 'drafts') params.delete('draft')
  if (tab === 'ledger' && options.search) {
    LEDGER_PARAM_KEYS.forEach(key => params.delete(key))
  }
  if (options.search) applySearchUpdates(params, options.search)
  writeUrl(PATH_BY_TAB[tab], params, options.replace === true)
}

export const updateAppSearch = (
  updates: Record<string, string | number | boolean | null | undefined>,
  options: { replace?: boolean } = { replace: true },
) => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  applySearchUpdates(params, updates)
  writeUrl(window.location.pathname, params, options.replace !== false)
}

export const ledgerRouteSearch = (state: Partial<LedgerRouteState>) => ({
  filters: state.filters?.join(',') || null,
  q: state.search || null,
  match: state.searchMode === 'exact' ? 'exact' : null,
  from: state.startDate || null,
  to: state.endDate || null,
  min: state.minAmount || null,
  max: state.maxAmount || null,
  recurring: state.recurringFilter && state.recurringFilter !== 'all' ? state.recurringFilter : null,
  wishlist: state.wishlistFilter && state.wishlistFilter !== 'all' ? state.wishlistFilter : null,
  type: state.txType || null,
  all: state.showAllCycles || null,
  range: state.range && state.range !== 'monthly' ? state.range : null,
  tx: state.highlightedTxId || null,
})
