import React from 'react'
import { Gauge, Save } from 'lucide-react'
import type { TransactionCategory } from '../../types'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { getCurrencySymbol } from '../../lib/utils'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { RowSyncStatus } from '../ui/RowSyncBadge'

interface CategoryLimitsCardProps {
  categories: TransactionCategory[]
  currency: string
  hideSensitive: boolean
  activeSyncId?: string | null
  onUpdate: (id: string, cycleLimit: number | null) => void
}

const normalizedValue = (value: number | null | undefined) => value == null ? null : value.toFixed(2)

export function CategoryLimitsCard({
  categories,
  currency,
  hideSensitive,
  activeSyncId,
  onUpdate,
}: CategoryLimitsCardProps) {
  const [drafts, setDrafts] = React.useState<Record<string, string | null>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    setDrafts(Object.fromEntries(categories.map(category => [category.id, normalizedValue(category.cycleLimit)])))
    setErrors({})
  }, [categories])

  const changedCategories = categories.filter(category => {
    const draft = drafts[category.id]
    const current = normalizedValue(category.cycleLimit)
    if (draft == null) return current != null
    const amount = Number(draft)
    return current == null || (Number.isFinite(amount) && Math.abs(amount - Number(current)) >= 0.005)
  })

  const save = () => {
    const nextErrors: Record<string, string> = {}
    const updates: Array<{ id: string; amount: number | null }> = []

    for (const category of changedCategories) {
      const draft = drafts[category.id]
      if (draft == null) {
        updates.push({ id: category.id, amount: null })
        continue
      }
      const amount = Number(draft)
      if (!draft.trim() || !Number.isFinite(amount) || amount <= 0) {
        nextErrors[category.id] = 'Enter an amount greater than zero.'
      } else if (amount > 9_999_999_999.99) {
        nextErrors[category.id] = 'Amount is above the supported range.'
      } else {
        updates.push({ id: category.id, amount })
      }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    updates.forEach(update => onUpdate(update.id, update.amount))
  }

  return (
    <section className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Gauge className="size-4 text-blue-500" /> Cycle Spending Guides
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Optional category expectations. Spending is never blocked when a guide is reached.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-500">
          {categories.filter(category => category.cycleLimit != null).length} tracked
        </span>
      </div>

      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {categories.map(category => {
          const enabled = drafts[category.id] != null
          const isSyncing = activeSyncId === category.id
          return (
            <div key={category.id} className="rounded-xl border border-border/50 bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Track ${category.name} cycle spending`}
                    disabled={hideSensitive || isSyncing}
                    onClick={() => {
                      setDrafts(previous => ({
                        ...previous,
                        [category.id]: enabled ? null : normalizedValue(category.cycleLimit) ?? '',
                      }))
                      setErrors(previous => ({ ...previous, [category.id]: '' }))
                    }}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? 'bg-blue-500' : 'bg-muted'}`}
                  >
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className={`truncate rounded border px-2 py-0.5 text-[10px] font-semibold ${getCategoryBadgeClass(category.name)}`}>
                    {category.name}
                  </span>
                  <RowSyncStatus isSyncing={isSyncing} isPending={category.isPendingSync} entityLabel="guide" />
                </div>
                {!enabled && <span className="text-[10px] font-semibold text-muted-foreground">No guide</span>}
              </div>

              {enabled && (
                <div className="mt-2">
                  <div className="relative flex items-center">
                    <span className="absolute left-3 z-10 text-xs font-semibold text-muted-foreground pointer-events-none">
                      {getCurrencySymbol(currency)}
                    </span>
                    <SmartAmountInput
                      type="text"
                      inputMode="decimal"
                      aria-label={`${category.name} cycle spending guide`}
                      disabled={hideSensitive || isSyncing}
                      value={drafts[category.id] ?? ''}
                      onChange={event => {
                        setDrafts(previous => ({ ...previous, [category.id]: event.target.value }))
                        setErrors(previous => ({ ...previous, [category.id]: '' }))
                      }}
                      placeholder="0.00"
                      className={`w-full rounded-xl border bg-background py-2 pr-3 text-sm focus:outline-none focus:ring-1 ${getCurrencySymbol(currency).length > 2 ? 'pl-12' : 'pl-9'} ${errors[category.id] ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-blue-500'}`}
                    />
                  </div>
                  {errors[category.id] && <p className="mt-1 text-[10px] font-semibold text-destructive">{errors[category.id]}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/30 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Changes apply from the current salary cycle onward; earlier cycle reports keep their original guide.
        </p>
        <button
          type="button"
          onClick={save}
          disabled={hideSensitive || changedCategories.length === 0}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground cursor-pointer"
        >
          <Save className="size-3.5" /> Save Guides
        </button>
      </div>
    </section>
  )
}
