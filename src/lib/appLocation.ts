import { APP_TABS, type AppTab } from '../types'
import type { TransactionLinkFilter } from './transactionFilters'

export type LedgerRouteRange = 'monthly' | '3month' | '6month' | 'yearly'
type LedgerRouteTxType = 'inflow' | 'outflow' | 'transfer' | null

export interface LedgerRouteState {
  filters: string[]
  search: string
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
}

export interface AppNavigationOptions {
  replace?: boolean
  search?: Record<string, string | number | boolean | null | undefined>
}

const PATH_BY_TAB: Record<AppTab, string> = {
  dashboard: '/dashboard',
  reports: '/reports',
  recurring: '/recurring',
  ledger: '/ledger',
  wishlist: '/wishlist',
  drafts: '/drafts',
  settings: '/settings',
  investments: '/investments',
  documents: '/vault',
}

const TAB_BY_PATH = Object.fromEntries(
  Object.entries(PATH_BY_TAB).map(([tab, path]) => [path, tab]),
) as Record<string, AppTab>

const LEDGER_PARAM_KEYS = [
  'filters',
  'q',
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
const RANGES = new Set<LedgerRouteRange>(['monthly', '3month', '6month', 'yearly'])
const TX_TYPES = new Set<Exclude<LedgerRouteTxType, null>>(['inflow', 'outflow', 'transfer'])

const parseLinkFilter = (value: string | null): TransactionLinkFilter => {
  if (value === 'exclude') return 'exclude'
  // `1` is the URL format used before this became a three-state filter.
  if (value === 'only' || value === '1') return 'only'
  return 'all'
}

const emptyLedgerRouteState = (): LedgerRouteState => ({
  filters: [],
  search: '',
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
    return { tab: 'dashboard', month: '', year: 0, ledger: emptyLedgerRouteState() }
  }

  const params = new URLSearchParams(window.location.search)
  const rawMonth = params.get('month') || ''
  const rawYear = Number(params.get('year') || 0)
  const range = params.get('range') as LedgerRouteRange | null
  const txType = params.get('type') as Exclude<LedgerRouteTxType, null> | null

  return {
    tab: parseTab(window.location.pathname, params),
    month: MONTHS.has(rawMonth) ? rawMonth : '',
    year: Number.isInteger(rawYear) && rawYear >= 1900 && rawYear <= 2200 ? rawYear : 0,
    ledger: {
      filters: (params.get('filters') || '').split(',').map(value => value.trim()).filter(Boolean),
      search: params.get('q') || '',
      startDate: params.get('from') || '',
      endDate: params.get('to') || '',
      minAmount: params.get('min') || '',
      maxAmount: params.get('max') || '',
      recurringFilter: parseLinkFilter(params.get('recurring')),
      wishlistFilter: parseLinkFilter(params.get('wishlist')),
      txType: txType && TX_TYPES.has(txType) ? txType : null,
      showAllCycles: params.get('all') === '1',
      range: range && RANGES.has(range) ? range : 'monthly',
      highlightedTxId: params.get('tx'),
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
  window.history[replace ? 'replaceState' : 'pushState']({}, '', nextUrl)
}

export const navigateToAppTab = (tab: AppTab, options: AppNavigationOptions = {}) => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (tab !== 'ledger') LEDGER_PARAM_KEYS.forEach(key => params.delete(key))
  if (tab !== 'recurring') params.delete('subscription')
  // `focus` scrolls Reports to one section. Deliberately not named `section`, which
  // Settings already owns for its own deep links and must survive this navigation.
  if (tab !== 'reports') params.delete('focus')
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
