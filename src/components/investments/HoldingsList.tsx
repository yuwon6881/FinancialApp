import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { InvestmentPortfolio } from '../../types'
import { cn, formatCurrencyVal } from '../../lib/utils'
import { buildSleeveIndex, sleeveLabelFor } from '../../lib/investmentAllocation'
import { filterHoldings, type AllocationFilter } from '../../lib/investmentHoldingFilter'
import { useIsExpanded } from '../../lib/breakpoints'
import { AmountText } from '../ui/AmountText'
import { Button } from '../ui/Button'
import { DataTable, DataTableBody, DataTableFooter, DataTableHeader, DataTableHeaderCell, DataTablePagination } from '../ui/DataTable'
import { panelClass } from '../ui/panelStyles'

type Holding = InvestmentPortfolio['holdings'][number]

const money = (value: number, currency: string) => formatCurrencyVal(value, currency)
const number = (value: number, digits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
const PAGE_SIZES = [10, 25, 50] as const

const gainTone = (value?: number) => value === undefined
  ? 'text-muted-foreground'
  : value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

/** Why a holding has no value yet, in the fewest words that still say what is missing. */
const missingValueLabel = (holding: Holding) =>
  holding.latestPriceNative === undefined ? 'No price yet' : 'Exchange rate missing'

/** The ticker in a quiet rounded tile -- the investments counterpart of a category icon. */
export function TickerTile({ symbol, className }: { symbol?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center overflow-hidden rounded-control bg-surface-2 text-caption font-semibold tracking-tight text-foreground dark:bg-surface-3',
        className,
      )}
    >
      {(symbol ?? '—').slice(0, 4)}
    </span>
  )
}

/**
 * What you hold. On phones and tablets it is a grouped list -- one row per fund, ticker, units and
 * price on the left, value and gain on the right -- under a header row per broker account; a row
 * opens the fund's detail sheet, which carries every other figure and how the value was worked
 * out. At the expanded tier it is the seven-column table.
 */
export const HoldingsTable = ({ portfolio, masked, filter, onSelectHolding, onClearFilter }: {
  portfolio: InvestmentPortfolio
  masked: boolean
  filter: AllocationFilter
  onSelectHolding: (holding: Holding) => void
  onClearFilter?: () => void
}) => {
  const expanded = useIsExpanded()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10)
  const sleeveIndex = useMemo(() => buildSleeveIndex(portfolio.instruments), [portfolio.instruments])
  const filterLabel = filter?.mode === 'sleeve' ? sleeveLabelFor(filter.key, sleeveIndex) : filter?.key
  const currency = portfolio.appCurrency

  const holdings = filterHoldings(portfolio.holdings, filter, sleeveIndex)
  const total = holdings.length
  const pages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page > pages) setPage(Math.max(1, pages))
  }, [page, pages])

  const paginatedHoldings = holdings.slice((page - 1) * pageSize, page * pageSize)

  const accountGroups = portfolio.accounts
    .map(account => {
      const accountHoldings = holdings.filter(holding => holding.accountId === account.id)
      const cash = portfolio.cashBalances.filter(balance => balance.accountId === account.id)
      const accountTotal = [...accountHoldings.map(value => value.valueApp), ...cash.map(value => value.amountApp)]
        .reduce<number | undefined>((sum, value) => sum === undefined || value === undefined ? undefined : sum + value, 0)
      return { account, holdings: accountHoldings, page: paginatedHoldings.filter(holding => holding.accountId === account.id), cash, total: accountTotal }
    })
    .filter(group => group.holdings.length > 0 || group.cash.length > 0)

  const accountTotal = (value: number | undefined) => masked
    ? <AmountText value={0} isMasked />
    : value === undefined
      ? <span className="font-normal text-muted-foreground">Exchange rate missing</span>
      : <AmountText value={value} currency={currency} />

  const cashLine = (cash: InvestmentPortfolio['cashBalances']) => cash.map(balance => (
    <span key={balance.currency} className={cn(!masked && balance.amount < 0 && 'text-red-600 dark:text-red-400')}>
      Cash {masked ? '••••' : money(balance.amount, balance.currency)}
    </span>
  ))

  return (
    <section aria-labelledby="holdings-title" className={cn(panelClass, '@container min-w-0 overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id="holdings-title" className="text-section text-foreground">What you hold</h2>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {filter ? <>Showing only {filterLabel}</> : `${total} fund${total === 1 ? '' : 's'}`}
          </p>
        </div>
        {filter && onClearFilter && (
          <Button variant="secondary" size="sm" onClick={onClearFilter}><X className="size-3.5" aria-hidden="true" /> Show all</Button>
        )}
      </div>

      {!expanded ? (
        <div className="mt-2">
          {accountGroups.map(({ account, holdings: accountHoldings, page: rows, cash, total: groupTotal }) => (
            <section key={account.id} aria-label={account.name} className="border-t border-border/60 first:border-t-0">
              <div className="flex items-center justify-between gap-3 px-5 py-2.5 sm:px-6">
                <div className="min-w-0">
                  <h3 className="truncate text-label font-medium text-foreground">{account.name}</h3>
                  <p className="flex min-w-0 flex-wrap gap-x-1.5 text-caption text-muted-foreground">
                    <span>{account.baseCurrency} · {accountHoldings.length} holding{accountHoldings.length === 1 ? '' : 's'}</span>
                    {cash.length > 0 && <span aria-hidden="true">·</span>}
                    {cashLine(cash)}
                  </p>
                </div>
                <span className="shrink-0 text-label font-semibold tabular-nums text-foreground">{accountTotal(groupTotal)}</span>
              </div>
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {rows.map(holding => (
                  <li key={`${holding.accountId}-${holding.instrumentId}`}>
                    <Button
                      variant="tertiary"
                      onClick={() => onSelectHolding(holding)}
                      aria-label={`${holding.symbol} · ${holding.name}`}
                      className="flex min-h-16 w-full items-center justify-start gap-3 rounded-none px-4 py-2.5 text-left font-normal hover:bg-surface-2/60 @sm:px-5 sm:px-6"
                    >
                      <TickerTile symbol={holding.symbol} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-foreground">{holding.name}</span>
                        <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                          {masked ? '••••' : number(holding.units, 8)} unit{holding.units === 1 ? '' : 's'}
                          {' · '}
                          {holding.latestPriceNative === undefined ? 'no price yet' : masked ? '••••' : money(holding.latestPriceNative, holding.currency)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="text-body font-semibold text-foreground">
                          {masked
                            ? <AmountText value={0} isMasked />
                            : holding.valueApp === undefined
                              ? <span className="text-label font-normal text-muted-foreground">{missingValueLabel(holding)}</span>
                              : <AmountText value={holding.valueApp} currency={currency} />}
                        </span>
                        {!masked && holding.unrealisedProfitLossApp !== undefined && (
                          <span className={cn('mt-0.5 text-caption tabular-nums', gainTone(holding.unrealisedProfitLossApp))}>
                            {holding.unrealisedProfitLossApp > 0 ? '+' : ''}{money(holding.unrealisedProfitLossApp, currency)} · {(holding.unrealisedPercent ?? 0).toFixed(1)}%
                          </span>
                        )}
                      </span>
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground @sm:block" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <>
          {/* One line per broker account instead of a card each: the table under it already
              names the account on every row. */}
          <ul className="mt-3 flex flex-wrap gap-2 px-5 sm:px-6">
            {accountGroups.map(({ account, holdings: accountHoldings, cash, total: groupTotal }) => (
              <li key={account.id} className="flex min-w-0 items-center gap-3 rounded-control bg-surface-2/70 px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-label font-medium text-foreground">{account.name}</span>
                  <span className="flex flex-wrap gap-x-1.5 text-caption text-muted-foreground">
                    <span>Base currency {account.baseCurrency} · {accountHoldings.length} holding{accountHoldings.length === 1 ? '' : 's'}</span>
                    {cash.length > 0 && <span aria-hidden="true">·</span>}
                    {cashLine(cash)}
                  </span>
                </span>
                <span className="ml-4 shrink-0 text-label font-semibold tabular-nums">{accountTotal(groupTotal)}</span>
              </li>
            ))}
          </ul>
          {/* Seven columns, not ten. The average price paid, the banked return and how the value
              was worked out are history rather than today's position; the fund's detail sheet,
              one click on its ticker, carries them. Nothing is hidden. */}
          <DataTable embedded horizontalOverflow="hidden" tableClassName="table-fixed" className="mt-3">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              <col className="w-[15%]" />
            </colgroup>
            <DataTableHeader>
              <DataTableHeaderCell>Investment</DataTableHeaderCell>
              <DataTableHeaderCell>Account</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Units</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Latest price</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Latest value ({currency})</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Latest move</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Gain on paper</DataTableHeaderCell>
            </DataTableHeader>
            <DataTableBody>
              {paginatedHoldings.map(holding => (
                <tr key={`${holding.accountId}-${holding.instrumentId}`} className="transition-colors hover:bg-surface-2/50">
                  <td className="px-4 py-2.5">
                    <Button
                      variant="tertiary"
                      onClick={() => onSelectHolding(holding)}
                      aria-label={`${holding.symbol} · ${holding.name}`}
                      className="-ml-2 flex h-auto min-h-0 w-[calc(100%+0.5rem)] items-center justify-start gap-3 rounded-control px-2 py-1.5 text-left font-normal lg:min-h-0"
                    >
                      <TickerTile symbol={holding.symbol} className="size-9" />
                      <span className="min-w-0">
                        <span className="block truncate text-label font-semibold text-foreground">{holding.symbol} <span className="font-normal text-muted-foreground">{holding.type}</span></span>
                        <span className="block truncate text-caption text-muted-foreground" title={holding.name}>{holding.name}</span>
                      </span>
                    </Button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground"><span className="block truncate" title={holding.accountName}>{holding.accountName}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{masked ? '••••' : number(holding.units, 8)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{masked ? '••••' : holding.latestPriceNative === undefined ? <span className="text-muted-foreground">No price yet</span> : money(holding.latestPriceNative, holding.currency)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{masked ? '••••' : holding.valueApp === undefined ? <span className="font-normal text-muted-foreground">{missingValueLabel(holding)}</span> : money(holding.valueApp, currency)}</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', masked ? '' : gainTone(holding.dailyChangeApp))}>{masked ? '••••' : holding.dailyChangeApp === undefined ? '—' : `${holding.dailyChangeApp > 0 ? '+' : ''}${money(holding.dailyChangeApp, currency)}`}</td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', masked ? '' : gainTone(holding.unrealisedProfitLossApp))}>
                    {masked ? '••••' : holding.unrealisedProfitLossApp === undefined ? '—' : (
                      <>
                        {holding.unrealisedProfitLossApp > 0 ? '+' : ''}{money(holding.unrealisedProfitLossApp, currency)}
                        <span className="block text-caption font-normal">{(holding.unrealisedPercent ?? 0).toFixed(1)}%</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </DataTableBody>
          </DataTable>
        </>
      )}
      {/* A pager under three rows only said "page 1 of 1"; it appears once there is a second page. */}
      {total > PAGE_SIZES[0] ? (
        <DataTableFooter>
          <DataTablePagination
            centerOnMobile
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            totalPages={pages}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value as (typeof PAGE_SIZES)[number]); setPage(1) }}
          />
        </DataTableFooter>
      ) : <div className="h-2" />}
    </section>
  )
}
