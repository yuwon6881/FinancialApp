import { Clock, Edit2 } from 'lucide-react'
import type { CategorySummary } from '../../types'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { getCategoryDotClass } from '../../lib/categoryColors'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { useIsMobile } from '../../lib/useIsMobile'
import { Button } from '../ui/Button'

interface CarryoverLedgerTableProps {
  categories: CategorySummary[]
  pendingDeductionsByCategory: Record<string, number>
  amountsMasked: boolean
  hideSensitive: boolean
  formatCurrency: (value: number) => string
  onAdjust: (category: CategorySummary) => void
}

export function CarryoverLedgerTable({
  categories,
  pendingDeductionsByCategory,
  amountsMasked,
  hideSensitive,
  formatCurrency,
  onAdjust,
}: CarryoverLedgerTableProps) {
  // Render one layout, not both. Previously the wide grid and the mobile card list
  // were both built for every category and one was CSS-hidden.
  const isMobile = useIsMobile()
  const amount = (value: number) => amountsMasked ? SENSITIVE_AMOUNT_MASK : formatCurrency(value)

  const adjustButton = (category: CategorySummary) => (
    <Button variant="unstyled" size="icon"
      type="button"
      onClick={() => onAdjust(category)}
      disabled={hideSensitive}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition select-none disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent sm:size-8"
      title={hideSensitive ? 'Unhide balances to edit' : 'Adjust balance'}
      aria-label={`Adjust ${category.name} balance`}
    >
      <Edit2 className="size-3" />
    </Button>
  )

  return (
    <div className="app-panel p-6 bg-card/92 border border-border/60 rounded-2xl">
      <h3 className="text-base font-bold text-foreground mb-1">Carryover Rolling Ledgers</h3>
      <p className="text-xs text-muted-foreground mb-4">Starting budget carries forward from the previous cycle's remaining balance.</p>

      {!isMobile && (
      <div className="overflow-x-auto">
        <div className="min-w-[800px] text-xs space-y-1">
          <div className="grid grid-cols-[1.8fr_1fr_1.5fr_2fr_2fr_2fr] items-center gap-4 border-b border-border/50 text-muted-foreground font-semibold pb-2.5 px-4 mb-2">
            <div>Category</div><div>Plan Target</div><div className="text-right">Income Added</div>
            <div className="text-right">Carried Over</div><div className="text-right">Net Change</div>
            <div className="text-right">Remaining Balance</div>
          </div>
          {categories.map(category => {
            const pending = pendingDeductionsByCategory[category.name] ?? 0
            return (
              <div key={category.name} className="grid grid-cols-[1.8fr_1fr_1.5fr_2fr_2fr_2fr] items-center gap-4 py-3 px-4 rounded-xl border border-transparent hover:bg-muted/10 transition">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <span className={`size-2.5 rounded-full ${getCategoryDotClass(category.name)}`} />{category.name}
                </div>
                <div className="text-muted-foreground font-medium">{(category.allocation * 100).toFixed(0)}%</div>
                <div className="text-right font-medium text-foreground">{amount(category.incomeAllocated ?? category.target)}</div>
                <div className="text-right text-muted-foreground font-medium">{amount(category.budget)}</div>
                <div className={`text-right font-medium ${category.netChange < 0 ? 'text-orange-500' : category.netChange > 0 ? 'text-blue-500' : ''}`}>
                  <div><SensitiveAmount value={category.netChange} isMasked={amountsMasked} formatFn={(v) => (v > 0 ? '+' : '') + formatCurrency(v)} /></div>
                  {pending > 0 && <div className="text-[10px] text-yellow-500 font-normal flex items-center justify-end gap-1 mt-0.5"><Clock className="size-3" />Pending: -{amount(pending)}</div>}
                </div>
                <div className="flex items-center justify-end gap-1.5 text-right">
                  <div className="flex min-w-[96px] flex-col items-end gap-1">
                    <div className={`font-bold ${category.remaining < 0 ? 'text-orange-500' : 'text-foreground'}`}>
                      <SensitiveAmount value={category.remaining} isMasked={amountsMasked} formatFn={formatCurrency} />
                    </div>
                    {pending > 0 && <div className={`text-[10px] font-semibold ${(category.remaining - pending) < 0 ? 'text-orange-500' : 'text-yellow-500'}`}>Projected: {amount(category.remaining - pending)}</div>}
                    <AccountBreakdown category={category} amountsMasked={amountsMasked} formatCurrency={formatCurrency} />
                  </div>
                  {adjustButton(category)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}

      {isMobile && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(category => {
          const pending = pendingDeductionsByCategory[category.name] ?? 0
          return (
            <div key={category.name} className="p-4 rounded-xl border border-border bg-background/50 space-y-3 shadow-xs transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm"><span className={`size-2.5 rounded-full ${getCategoryDotClass(category.name)}`} />{category.name}</div>
                <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded-md text-muted-foreground">Target: {(category.allocation * 100).toFixed(0)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs border-t border-border/30 pt-2.5">
                <Metric label="Income Added" value={amount(category.incomeAllocated ?? category.target)} />
                <Metric label="Carried Over" value={amount(category.budget)} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs border-t border-border/30 pt-2.5">
                <div className="col-start-1">
                  <span className="text-muted-foreground text-[10px] block mb-0.5">Net Change</span>
                  <div className="flex items-center h-6">
                    <span className={`font-bold truncate ${category.netChange < 0 ? 'text-orange-500' : category.netChange > 0 ? 'text-blue-500' : 'text-foreground'}`}>
                      <SensitiveAmount value={category.netChange} isMasked={amountsMasked} formatFn={(v) => (v > 0 ? '+' : '') + formatCurrency(v)} />
                    </span>
                  </div>
                </div>
                <div className="col-start-2">
                  <span className="text-muted-foreground text-[10px] block mb-0.5">Remaining Balance</span>
                  <div className="flex items-center gap-1.5 h-6">
                    <span className={`font-bold truncate ${category.remaining < 0 ? 'text-orange-500' : 'text-foreground'}`}>
                      <SensitiveAmount value={category.remaining} isMasked={amountsMasked} formatFn={formatCurrency} />
                    </span>
                    {adjustButton(category)}
                  </div>
                </div>
                    {pending > 0 && (
                  <>
                    <div className="col-start-1">
                      <span className="text-[10px] font-semibold text-yellow-500 block truncate">Pending: -{amount(pending)}</span>
                    </div>
                    <div className="col-start-2">
                      <span className={`text-[10px] font-semibold block truncate ${(category.remaining - pending) < 0 ? 'text-orange-500' : 'text-yellow-500'}`}>Projected: {amount(category.remaining - pending)}</span>
                    </div>
                      </>
                    )}
                    <AccountBreakdown category={category} amountsMasked={amountsMasked} formatCurrency={formatCurrency} />
                  </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

function AccountBreakdown({
  category,
  amountsMasked,
  formatCurrency,
}: {
  category: CategorySummary
  amountsMasked: boolean
  formatCurrency: (value: number) => string
}) {
  if (!category.accounts?.length) return null
  return (
    <details className="w-full text-left text-[10px] sm:max-w-[230px]">
      <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
        {category.accounts.length} {category.accounts.length === 1 ? 'account' : 'accounts'}
      </summary>
      <div className="mt-1.5 space-y-1 rounded-lg border border-border/50 bg-muted/10 p-2">
        {category.accounts.map(account => (
          <div key={account.id} className="flex items-center justify-between gap-2">
            <span className={`min-w-0 truncate ${account.isArchived ? 'text-muted-foreground' : 'text-foreground'}`}>
              {account.name}{account.isArchived ? ' (Closed)' : ''}
            </span>
            <SensitiveAmount value={account.remaining} isMasked={amountsMasked} formatFn={formatCurrency} className="shrink-0 font-semibold" />
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1 font-bold text-foreground">
          <span>Accounts total</span>
          <SensitiveAmount value={category.accounts.reduce((sum, account) => sum + account.remaining, 0)} isMasked={amountsMasked} formatFn={formatCurrency} />
        </div>
      </div>
    </details>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground text-[10px] block mb-0.5">{label}</span><span className="font-semibold text-foreground">{value}</span></div>
}
