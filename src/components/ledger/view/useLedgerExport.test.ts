import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLedgerExport, type UseLedgerExportOptions } from './useLedgerExport'

const downloadCsvBlob = vi.fn()
const downloadCsvRows = vi.fn()

vi.mock('../../../lib/csvExport', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/csvExport')>('../../../lib/csvExport')
  return {
    ...actual,
    downloadCsvBlob: (...args: unknown[]) => downloadCsvBlob(...args),
    downloadCsvRows: (...args: unknown[]) => downloadCsvRows(...args),
  }
})

const baseOptions = (overrides: Partial<UseLedgerExportOptions> = {}): UseLedgerExportOptions => ({
  hideSensitive: false,
  showAllCycles: true,
  cyclesRange: 'all',
  selectedMonth: 'Aug',
  selectedYear: 2026,
  cycleDay: 28,
  accounts: [],
  appliedFilters: [],
  appliedSearch: '',
  appliedSearchMode: 'contains',
  appliedStartDate: '',
  appliedEndDate: '',
  appliedMinAmount: '',
  appliedMaxAmount: '',
  appliedRecurringFilter: 'all',
  appliedWishlistFilter: 'all',
  appliedAccountIds: [],
  appliedTxTypeFilter: [],
  sortOrder: 'date-desc',
  allCyclesRange: null,
  serverResult: { items: [], total: 0, page: 1, pageSize: 10 },
  serverIsReplacingRows: false,
  displayTransactions: [],
  paginatedTransactions: [],
  filteredTransactions: [],
  filteredPendingTransactions: [],
  onExportTransactions: vi.fn().mockResolvedValue({ blob: new Blob(['a']), filename: 'server.csv' }),
  currentPage: 1,
  ...overrides,
})

const exportedFilename = async (overrides: Partial<UseLedgerExportOptions> = {}) => {
  const { result } = renderHook(() => useLedgerExport(baseOptions(overrides)))
  await act(() => result.current.handleExportAll())
  return downloadCsvBlob.mock.calls.at(-1)?.[1] as string
}

describe('useLedgerExport filenames', () => {
  beforeEach(() => {
    downloadCsvBlob.mockClear()
    downloadCsvRows.mockClear()
  })

  it('does not claim a transaction-type filter when none is selected', async () => {
    expect(await exportedFilename()).toBe('All_Records.csv')
  })

  it('names the one selected transaction type', async () => {
    expect(await exportedFilename({ appliedTxTypeFilter: ['outflow'] })).toBe('All_Outflows_Records.csv')
  })

  it('names both selected transaction types', async () => {
    expect(await exportedFilename({ appliedTxTypeFilter: ['inflow', 'transfer'] }))
      .toBe('All_Inflows_+_Transfers_Records.csv')
  })

  it('keeps the scoped range in the name alongside other filters', async () => {
    expect(await exportedFilename({ cyclesRange: '3month', appliedFilters: ['Stability'] }))
      .toBe('Last_3_Cycles_Stability_Category_Records.csv')
  })
})
