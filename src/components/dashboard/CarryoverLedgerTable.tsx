import { Clock, Settings, Wallet } from 'lucide-react'
import { useState } from 'react'
import type { CategorySummary } from '../../types'
import { SensitiveAmount } from '../ui/SensitiveAmount'
import { getCategoryBadgeClass, getCategoryDotClass } from '../../lib/categoryColors'
import { SENSITIVE_AMOUNT_MASK } from '../../lib/utils'
import { useIsMobile } from '../../lib/useIsMobile'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/BottomSheet'
import { AlertBanner } from '../ui/AlertBanner'

interface CarryoverLedgerTableProps {
  categories: CategorySummary[]
  isCurrentCycle: boolean
  cycleLabel: string
  pendingDeductionsByCategory: Record<string, number>
  amountsMasked: boolean
  hideSensitive: boolean
  formatCurrency: (value: number) => string
  onNavigateToAccounts?: (targetIdOrBucket?: string | null) => void
}

export function CarryoverLedgerTable({
  categories,
  isCurrentCycle,
  cycleLabel,
  pendingDeductionsByCategory,
  amountsMasked,
  hideSensitive: _hideSensitive,
  formatCurrency,
  onNavigateToAccounts,
}: CarryoverLedgerTableProps) {
  const isMobile = useIsMobile()
  const [selectedCategory, setSelectedCategory] = useState<CategorySummary | null>(null)
  const amount = (value: number) => amountsMasked ? SENSITIVE_AMOUNT_MASK : formatCurrency(value)

  return (
    <div className="app-panel p-6 bg-card/92 border border-border/60 rounded-2xl">
      <h3 className="text-base font-bold text-foreground mb-1">Carryover Rolling Ledgers</h3>
      <p className="text-xs text-muted-foreground mb-4">Starting budget carries forward from the previous cycle's remaining balance.</p>

      {!isMobile && (
      <div className="overflow-x-auto">
        <div className="min-w-[800px] text-xs space-y-1">
          <div className="grid grid-cols-[2.2fr_1fr_1.4fr_1.4fr_1.7fr_2.1fr] items-center gap-4 border-b border-border/50 text-muted-foreground font-semibold pb-2.5 px-4 mb-2">
            <div>Category</div><div>Plan Target</div><div className="text-right">Income Added</div>
            <div className="text-right">Carried Over</div><div className="text-right">Net Change</div>
            <div className="text-right">Remaining Balance</div>
          </div>
          {categories.map(category => {
            const pending = pendingDeductionsByCategory[category.name] ?? 0
            const hasAccounts = Boolean(category.accounts?.length)
            const badgeClass = getCategoryBadgeClass(category.name)
            return (
              <div key={category.name} className="grid grid-cols-[2.2fr_1fr_1.4fr_1.4fr_1.7fr_2.1fr] items-center gap-4 py-3 px-4 rounded-xl border border-transparent hover:bg-muted/10 transition">
                <div className="flex items-center gap-2 font-bold text-foreground min-w-0">
                  <span className={`size-2.5 rounded-full shrink-0 ${getCategoryDotClass(category.name)}`} />
                  <span className="truncate">{category.name}</span>
                  {hasAccounts && (
                    <Button
                      variant="unstyled"
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition cursor-pointer select-none shrink-0 ${badgeClass}`}
                      title={`View ${category.accounts!.length} ${category.accounts!.length === 1 ? 'account' : 'accounts'} in ${category.name}`}
                      aria-label={`View account breakdown for ${category.name}`}
                    >
                      <Wallet className="size-3 shrink-0" aria-hidden="true" />
                      <span>{category.accounts!.length} {category.accounts!.length === 1 ? 'account' : 'accounts'}</span>
                    </Button>
                  )}
                </div>
                <div className="text-muted-foreground font-medium">{(category.allocation * 100).toFixed(0)}%</div>
                <div className="text-right font-medium text-foreground">{amount(category.incomeAllocated ?? category.target)}</div>
                <div className="text-right text-muted-foreground font-medium">{amount(category.budget)}</div>
                <div className={`text-right font-medium ${category.netChange < 0 ? 'text-orange-500' : category.netChange > 0 ? 'text-blue-500' : ''}`}>
                  <div><SensitiveAmount value={category.netChange} isMasked={amountsMasked} formatFn={(v) => (v > 0 ? '+' : '') + formatCurrency(v)} /></div>
                  {pending > 0 && <div className="text-[10px] text-yellow-500 font-normal flex items-center justify-end gap-1 mt-0.5"><Clock className="size-3" />Pending: -{amount(pending)}</div>}
                </div>
                <div className="text-right">
                  <Button
                    variant="unstyled"
                    type="button"
                    onClick={() => onNavigateToAccounts ? onNavigateToAccounts(category.name) : undefined}
                    className="group inline-flex flex-col items-end cursor-pointer select-none rounded-lg p-1.5 -m-1.5 hover:bg-primary/10 transition-colors"
                    title={onNavigateToAccounts ? `Manage ${category.name} in Settings` : undefined}
                    aria-label={`Remaining balance for ${category.name}: ${formatCurrency(category.remaining)}. Manage in Settings`}
                  >
                    <div className={`font-bold transition-colors group-hover:text-accent-ink ${category.remaining < 0 ? 'text-orange-500' : 'text-foreground'}`}>
                      <SensitiveAmount value={category.remaining} isMasked={amountsMasked} formatFn={formatCurrency} />
                    </div>
                    {pending > 0 && (
                      <div className={`text-[10px] font-semibold mt-0.5 ${(category.remaining - pending) < 0 ? 'text-orange-500' : 'text-yellow-500'}`}>
                        Projected: {amount(category.remaining - pending)}
                      </div>
                    )}
                  </Button>
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
          const hasAccounts = Boolean(category.accounts?.length)
          const badgeClass = getCategoryBadgeClass(category.name)
          return (
            <div key={category.name} className="p-4 rounded-xl border border-border bg-background/50 space-y-3 shadow-xs transition">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span className={`size-2.5 rounded-full ${getCategoryDotClass(category.name)}`} />
                  <span>{category.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasAccounts && (
                    <Button
                      variant="unstyled"
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer select-none ${badgeClass}`}
                      title={`View ${category.accounts!.length} ${category.accounts!.length === 1 ? 'account' : 'accounts'}`}
                      aria-label={`View account breakdown for ${category.name}`}
                    >
                      <Wallet className="size-3 shrink-0" aria-hidden="true" />
                      <span>{category.accounts!.length}</span>
                    </Button>
                  )}
                  <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded-md text-muted-foreground">Target: {(category.allocation * 100).toFixed(0)}%</span>
                </div>
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
                  <div className="flex items-center h-6">
                    <Button
                      variant="unstyled"
                      type="button"
                      onClick={() => onNavigateToAccounts ? onNavigateToAccounts(category.name) : undefined}
                      className="group inline-flex items-center gap-1.5 cursor-pointer select-none rounded-md px-1.5 -mx-1.5 py-0.5 hover:bg-primary/10 transition-colors"
                      title={onNavigateToAccounts ? `Manage ${category.name} in Settings` : undefined}
                      aria-label={`Remaining balance for ${category.name}: ${formatCurrency(category.remaining)}. Manage in Settings`}
                    >
                      <span className={`font-bold truncate transition-colors group-hover:text-accent-ink ${category.remaining < 0 ? 'text-orange-500' : 'text-foreground'}`}>
                        <SensitiveAmount value={category.remaining} isMasked={amountsMasked} formatFn={formatCurrency} />
                      </span>
                    </Button>
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
              </div>
            </div>
          )
        })}
      </div>
      )}

      {selectedCategory && (
        <BottomSheet
          isOpen={Boolean(selectedCategory)}
          onClose={() => setSelectedCategory(null)}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <span className={`size-3 shrink-0 rounded-full ${getCategoryDotClass(selectedCategory.name)} shadow-xs`} />
              <span className="text-base font-bold text-foreground truncate">{selectedCategory.name} Account Balances</span>
            </div>
          }
          headerActions={
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 ${getCategoryBadgeClass(selectedCategory.name)}`}>
              {(selectedCategory.allocation * 100).toFixed(0)}% Allocation
            </span>
          }
          description={`Accounts contributing to the ${selectedCategory.name} ledger balance for ${cycleLabel}.`}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              {onNavigateToAccounts && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    onNavigateToAccounts(selectedCategory.name)
                    setSelectedCategory(null)
                  }}
                  className="gap-1.5 border-primary/30 bg-primary/5 text-accent-ink hover:bg-primary/10 hover:border-primary/50 font-semibold text-xs"
                >
                  <Settings className="size-3.5" />
                  Manage {selectedCategory.name} in Settings
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setSelectedCategory(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-3 pt-2">
            {!isCurrentCycle && (
              <AlertBanner variant="info">
                Account editing and corrections use today's balance, not this cycle's closing balance. Any correction posts to today's cycle.
              </AlertBanner>
            )}
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                <span>Account</span>
                <span>{isCurrentCycle ? 'Current balance' : 'Balance at close'}</span>
              </div>
              <div className="divide-y divide-border/30">
                {selectedCategory.accounts?.map(account => (
                  <div key={account.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs hover:bg-muted/15 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`grid size-9 shrink-0 place-items-center rounded-xl border shadow-xs ${getCategoryBadgeClass(selectedCategory.name)}`}>
                        <Wallet className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`block truncate font-bold ${account.isArchived ? 'text-muted-foreground line-through decoration-border' : 'text-foreground'}`}>
                            {account.name}
                          </span>
                          {account.isArchived && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                              Closed
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {account.isArchived ? 'Archived account' : 'Active ledger account'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <SensitiveAmount
                        value={account.remaining}
                        isMasked={amountsMasked}
                        formatFn={formatCurrency}
                        className={`font-bold tabular-nums text-sm ${account.remaining < 0 ? 'text-orange-500 dark:text-orange-400' : 'text-foreground'}`}
                      />
                      {onNavigateToAccounts && (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => {
                            onNavigateToAccounts(account.id)
                            setSelectedCategory(null)
                          }}
                          title={`Edit ${account.name} in Settings`}
                          aria-label={`Edit ${account.name} in Settings`}
                          className="h-7 px-2.5 text-[11px] font-semibold border-border/70 hover:border-primary/40 hover:bg-primary/5 hover:text-accent-ink transition"
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/40 px-4 py-3.5 text-xs font-bold">
                <div className="flex min-w-0 items-center gap-2 text-foreground">
                  <span className="whitespace-nowrap">{isCurrentCycle ? 'Total accounts balance' : 'Total balance at close'}</span>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold shrink-0 whitespace-nowrap ${getCategoryBadgeClass(selectedCategory.name)}`}>
                    {selectedCategory.accounts?.length ?? 0} {selectedCategory.accounts?.length === 1 ? 'account' : 'accounts'}
                  </span>
                </div>
                <SensitiveAmount
                  value={selectedCategory.accounts?.reduce((sum, a) => sum + a.remaining, 0) ?? 0}
                  isMasked={amountsMasked}
                  formatFn={formatCurrency}
                  className="shrink-0 text-base font-extrabold tabular-nums text-foreground"
                />
              </div>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground text-[10px] block mb-0.5">{label}</span><span className="font-semibold text-foreground">{value}</span></div>
}
