import React from 'react'
import { ChevronDown, ChevronUp, Gauge, Save } from 'lucide-react'
import type { TransactionCategory } from '../../types'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { isSpendingGuideCategory, isSystemCategoryName } from '../../lib/categoryFlow'
import { getCurrencySymbol } from '../../lib/utils'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { CollapsibleBody } from '../ui/CollapsibleBody'
import { ToggleButton } from '../ui/ToggleButton'
import { FormField } from '../ui/FormField'
import { focusFirstInvalidField } from '../ui/formValidation'
import { Button } from '../ui/Button'
import { SensitiveMask } from '../ui/SensitiveAmount'

interface CategoryLimitsCardProps {
  categories: TransactionCategory[]
  currency: string
  hideSensitive: boolean
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  onUpdate: (id: string, cycleLimit: number | null) => void
}

const normalizedValue = (value: number | null | undefined) => value == null ? null : value.toFixed(2)

export function CategoryLimitsCard({
  categories,
  currency,
  hideSensitive,
  activeSyncId,
  activeSyncIds,
  onUpdate,
}: CategoryLimitsCardProps) {
  const spendingCategories = React.useMemo(
    () => categories.filter(category => !isSystemCategoryName(category.name) && isSpendingGuideCategory(category)),
    [categories],
  )
  const [drafts, setDrafts] = React.useState<Record<string, string | null>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const sectionRef = React.useRef<HTMLElement>(null)
  const [isOpen, setIsOpen] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search
      const hash = window.location.hash
      if (search.includes('category') || search.includes('limits') || hash.includes('category') || hash.includes('limits')) {
        return true
      }
      return window.innerWidth >= 768
    }
    return true
  })

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search
      const hash = window.location.hash
      if (search.includes('category') || search.includes('limits') || hash.includes('category') || hash.includes('limits')) {
        setIsOpen(true)
      }
    }
  }, [])

  React.useEffect(() => {
    setDrafts(Object.fromEntries(spendingCategories.map(category => [category.id, normalizedValue(category.cycleLimit)])))
    setErrors({})
  }, [spendingCategories])

  React.useEffect(() => {
    if (!hideSensitive) return
    setDrafts(Object.fromEntries(spendingCategories.map(category => [category.id, normalizedValue(category.cycleLimit)])))
    setErrors({})
  }, [hideSensitive, spendingCategories])

  const changedCategories = spendingCategories.filter(category => {
    const draft = drafts[category.id]
    const current = normalizedValue(category.cycleLimit)
    if (draft == null) return current != null
    const amount = Number(draft)
    return current == null || (Number.isFinite(amount) && Math.abs(amount - Number(current)) >= 0.005)
  })

  const save = () => {
    if (hideSensitive) return
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
    if (Object.keys(nextErrors).length > 0) {
      if (sectionRef.current) focusFirstInvalidField(sectionRef.current)
      return
    }
    updates.forEach(update => onUpdate(update.id, update.amount))
  }

  return (
    <section ref={sectionRef} id="category-limits-card" className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen) } }}
        aria-expanded={isOpen}
        className="flex items-center justify-between gap-3 select-none cursor-pointer"
      >
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Gauge className="size-4 text-blue-500" /> Cycle Spending Guides
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Optional category expectations. Spending is never blocked when a guide is reached.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-500">
            {spendingCategories.filter(category => category.cycleLimit != null).length} tracked
          </span>
          {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </div>

      <CollapsibleBody open={isOpen}>
        <div className="pt-4 space-y-4">
          {/* No overscroll-contain: inline lists let the scroll chain to the page
              once they bottom out, matching every other in-page list in the app.
              Containment is reserved for floating popovers and sheet panels. */}
          <div className="max-h-80 sm:max-h-96 overflow-y-auto pr-1 space-y-2.5 touch-pan-y">
            {spendingCategories.map(category => {
              const enabled = drafts[category.id] != null
              const syncIds = activeSyncIds?.length ? activeSyncIds : activeSyncId ? [activeSyncId] : []
              const isSyncing = syncIds.includes(category.id)
                || Boolean(category.pendingSyncOperationId && syncIds.includes(category.pendingSyncOperationId))
              return (
                <div
                  key={category.id}
                  className={`rounded-xl border p-3 sm:p-3.5 transition-all duration-200 ${
                    enabled
                      ? 'border-blue-500/25 bg-blue-500/5 dark:bg-blue-500/10'
                      : 'border-border/40 bg-muted/20 hover:border-border/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ToggleButton
                        active={enabled}
                        disabled={hideSensitive || isSyncing}
                        label={`Track ${category.name} cycle spending`}
                        className="size-6 shrink-0"
                        onClick={() => {
                          setDrafts(previous => ({
                            ...previous,
                            [category.id]: enabled ? null : (normalizedValue(category.cycleLimit) ?? ''),
                          }))
                          setErrors(previous => ({ ...previous, [category.id]: '' }))
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className={`truncate rounded-md border px-2.5 py-0.5 text-xs font-semibold ${getCategoryBadgeClass(category.name)}`}>
                          {category.name}
                        </span>
                        <RowSyncStatus isSyncing={isSyncing} isPending={category.isPendingSync} entityLabel="guide" />
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold shrink-0 ${enabled ? 'text-blue-500 font-bold' : 'text-muted-foreground'}`}>
                      {enabled ? 'Active Guide' : 'No Guide'}
                    </span>
                  </div>

                  {enabled && (
                    <FormField
                      label={`${category.name} cycle spending guide`}
                      required
                      error={errors[category.id]}
                      className="mt-3 pt-3 border-t border-border/30 animate-in fade-in duration-150"
                      labelClassName="text-[10px] uppercase tracking-wider"
                      errorClassName="text-[10px] font-semibold"
                    >
                      {hideSensitive ? (
                        <div className="flex h-10 items-center rounded-md border border-border bg-muted/20 px-3">
                          <SensitiveMask />
                        </div>
                      ) : (
                      <div className="relative flex items-center">
                        <span className="absolute left-3 z-10 text-xs font-bold text-muted-foreground pointer-events-none">
                          {getCurrencySymbol(currency)}
                        </span>
                        <SmartAmountInput
                          type="text"
                          inputMode="decimal"
                          disabled={isSyncing}
                          value={drafts[category.id] ?? ''}
                          onChange={event => {
                            setDrafts(previous => ({ ...previous, [category.id]: event.target.value }))
                            setErrors(previous => ({ ...previous, [category.id]: '' }))
                          }}
                          placeholder="0.00"
                          className={`w-full py-2 pr-3 text-sm font-semibold ${
                            getCurrencySymbol(currency).length > 2 ? 'pl-12' : 'pl-9'
                          }`}
                        />
                      </div>
                      )}
                    </FormField>
                  )}
                </div>
              )
            })}
            {spendingCategories.length === 0 && (
              <p className="rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
                Inflow categories do not use spending guides.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/30 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Changes apply from the current salary cycle onward; earlier cycle reports keep their original guide.
            </p>
            <Button
              type="button"
              onClick={save}
              disabled={hideSensitive || changedCategories.length === 0}
              className="shrink-0 rounded-xl px-4 py-2"
            >
              <Save className="size-3.5" /> Save Guides
            </Button>
          </div>
        </div>
      </CollapsibleBody>
    </section>
  )
}
