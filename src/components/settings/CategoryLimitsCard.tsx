import React from 'react'
import { ChevronDown, Save } from 'lucide-react'
import type { CategoryBreakdown, CategoryLimitProgress, TransactionCategory } from '../../types'
import { isSpendingGuideCategory, isSystemCategoryName } from '../../lib/categoryFlow'
import { cn, getCurrencySymbol } from '../../lib/utils'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { ToggleButton } from '../ui/ToggleButton'
import { FormField } from '../ui/FormField'
import { focusFirstInvalidField } from '../ui/formValidation'
import { Button } from '../ui/Button'
import { SensitiveMask } from '../ui/SensitiveAmount'
import { AmountText } from '../ui/AmountText'
import { Badge } from '../ui/Badge'
import { CategoryIcon } from '../ui/CategoryIcon'
import { Meter } from '../ui/Meter'
import { panelClass } from '../ui/panelStyles'

interface CategoryLimitsCardProps {
  categories: TransactionCategory[]
  currency: string
  hideSensitive: boolean
  activeSyncId?: string | null
  activeSyncIds?: ReadonlyArray<string>
  onUpdate: (id: string, cycleLimit: number | null) => void
  last3CategoryBreakdown?: CategoryBreakdown[]
  last6CategoryBreakdown?: CategoryBreakdown[]
  /** The cycle's spend per category, for the "spent" figure and the meter on each row. */
  cycleSpend?: CategoryBreakdown[]
  /** The server's own reading of each limit this cycle, which also weighs pending bills. */
  limitProgress?: CategoryLimitProgress[]
}

const normalizedValue = (value: number | null | undefined) => value == null ? null : value.toFixed(2)

const METER_TONE = {
  Exceeded: 'bg-red-500',
  Watch: 'bg-amber-500',
} as const

/**
 * Plan › Budget › Categories & limits: one row per spending category, reading as "how much of this
 * cycle's limit is used" -- the category, what it has spent, its limit and a meter. The amount is
 * edited in place: tapping the row opens its field, and switching a limit on opens it straight away.
 * Save appears with the changes and stays reachable while the list scrolls.
 */
export function CategoryLimitsCard({
  categories,
  currency,
  hideSensitive,
  activeSyncId,
  activeSyncIds,
  onUpdate,
  last3CategoryBreakdown = [],
  last6CategoryBreakdown = [],
  cycleSpend = [],
  limitProgress = [],
}: CategoryLimitsCardProps) {
  const spendingCategories = React.useMemo(
    () => categories.filter(category => !isSystemCategoryName(category.name) && isSpendingGuideCategory(category)),
    [categories],
  )
  const [drafts, setDrafts] = React.useState<Record<string, string | null>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const dirtyIdsRef = React.useRef(new Set<string>())
  const sectionRef = React.useRef<HTMLElement>(null)
  const idPrefix = React.useId().replace(/:/g, '')

  const suggestedByCategory = React.useMemo(() => {
    const suggestions = new Map<string, number>()
    for (const item of last6CategoryBreakdown) suggestions.set(item.category, item.amount / 6)
    for (const item of last3CategoryBreakdown) suggestions.set(item.category, item.amount / 3)
    return suggestions
  }, [last3CategoryBreakdown, last6CategoryBreakdown])
  const spendByCategory = React.useMemo(
    () => new Map(cycleSpend.map(item => [item.category, item.amount])),
    [cycleSpend],
  )
  const progressByCategory = React.useMemo(
    () => new Map(limitProgress.map(item => [item.category, item])),
    [limitProgress],
  )

  React.useEffect(() => {
    setDrafts(previous => Object.fromEntries(spendingCategories.map(category => {
      const serverValue = normalizedValue(category.cycleLimit)
      const draft = previous[category.id]
      if (dirtyIdsRef.current.has(category.id) && draft !== undefined && draft !== serverValue) {
        return [category.id, draft]
      }
      dirtyIdsRef.current.delete(category.id)
      return [category.id, serverValue]
    })))
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => dirtyIdsRef.current.has(id))))
  }, [spendingCategories])

  React.useEffect(() => {
    if (!hideSensitive) return
    dirtyIdsRef.current.clear()
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
  const trackedCount = spendingCategories.filter(category => category.cycleLimit != null).length

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
      // Rows with an error are always open, so the field to focus is mounted by the next frame.
      requestAnimationFrame(() => {
        if (sectionRef.current) focusFirstInvalidField(sectionRef.current)
      })
      return
    }
    updates.forEach(update => {
      dirtyIdsRef.current.delete(update.id)
      onUpdate(update.id, update.amount)
    })
    setExpandedId(null)
  }

  const discard = () => {
    dirtyIdsRef.current.clear()
    setDrafts(Object.fromEntries(spendingCategories.map(category => [category.id, normalizedValue(category.cycleLimit)])))
    setErrors({})
    setExpandedId(null)
  }

  const setDraft = (id: string, value: string | null) => {
    dirtyIdsRef.current.add(id)
    setDrafts(previous => ({ ...previous, [id]: value }))
    setErrors(previous => ({ ...previous, [id]: '' }))
  }

  const saved = React.useMemo(() => ({
    tracked: spendingCategories.filter(category => category.cycleLimit != null),
    untracked: spendingCategories.filter(category => category.cycleLimit == null),
  }), [spendingCategories])
  const [showUntracked, setShowUntracked] = React.useState(false)
  // Open by default when nothing is tracked yet, and whenever a folded row holds an unsaved change.
  const untrackedOpen = showUntracked
    || saved.tracked.length === 0
    || saved.untracked.some(category => drafts[category.id] != null)

  const symbol = getCurrencySymbol(currency)
  const hasChanges = changedCategories.length > 0

  const renderRow = (category: TransactionCategory) => {
      const draft = drafts[category.id]
      const enabled = draft != null
      const syncIds = activeSyncIds?.length ? activeSyncIds : activeSyncId ? [activeSyncId] : []
      const isSyncing = syncIds.includes(category.id)
        || Boolean(category.pendingSyncOperationId && syncIds.includes(category.pendingSyncOperationId))
      const suggested = suggestedByCategory.get(category.name)
      const progress = progressByCategory.get(category.name)
      const spent = progress?.spent ?? spendByCategory.get(category.name) ?? 0
      const draftAmount = draft != null && draft.trim() ? Number(draft) : Number.NaN
      const limit = Number.isFinite(draftAmount) && draftAmount > 0 ? draftAmount : null
      const percent = limit ? (spent / limit) * 100 : 0
      const unchanged = limit != null && category.cycleLimit != null && Math.abs(limit - category.cycleLimit) < 0.005
      const status = unchanged && progress ? progress.status : percent > 100 ? 'Exceeded' : percent >= 80 ? 'Watch' : 'OnTrack'
      const over = limit != null ? spent - limit : 0
      const error = errors[category.id]
      const open = enabled && (expandedId === category.id || Boolean(error))
      const editorId = `${idPrefix}-${category.id}-editor`

      return (
        <li key={category.id} className={cn(open && 'bg-surface-2/40')}>
          <div className="flex items-center gap-1 pr-2 sm:pr-3">
            {(() => {
              const content = (
                <>
                  <CategoryIcon category={category.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-foreground">{category.name}</span>
                    <span className={cn('block truncate text-caption', enabled && status === 'Exceeded' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                      {hideSensitive
                        ? (enabled ? 'Limit set' : 'No limit')
                        : enabled
                          ? (over > 0
                            ? <><AmountText value={over} currency={currency} /> over</>
                            : <><AmountText value={spent} currency={currency} /> spent</>)
                          : spent > 0
                            ? <>No limit · <AmountText value={spent} currency={currency} /> spent</>
                            : 'No limit'}
                    </span>
                  </span>
                  {enabled && (
                    <span className="flex shrink-0 items-center gap-1 text-body font-medium text-foreground tabular-nums">
                      {limit != null
                        ? <AmountText value={limit} currency={currency} isMasked={hideSensitive} />
                        : <span className="text-muted-foreground">Set</span>}
                      <ChevronDown aria-hidden="true" className={cn('hidden size-3.5 text-muted-foreground transition-transform duration-200 @xs:block', open && 'rotate-180')} />
                    </span>
                  )}
                </>
              )
              const rowClass = 'flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-1 text-left sm:pl-5 lg:min-h-14'
              // Only a tracked category has an amount to edit, so only its row is a control.
              return enabled ? (
                <Button
                  variant="tertiary"
                  type="button"
                  onClick={() => setExpandedId(current => current === category.id ? null : category.id)}
                  aria-expanded={open}
                  aria-controls={open ? editorId : undefined}
                  className={cn(rowClass, 'h-auto justify-start rounded-none font-normal hover:bg-transparent')}
                >
                  {content}
                </Button>
              ) : (
                <div className={rowClass}>{content}</div>
              )
            })()}
            <ToggleButton
              active={enabled}
              disabled={hideSensitive || isSyncing}
              label={`Track ${category.name} cycle spending`}
              className="size-6 shrink-0"
              mutationStatus={{ isSyncing, isPending: category.isPendingSync }}
              mutationEntityLabel="limit"
              onClick={() => {
                setDraft(category.id, enabled ? null : (normalizedValue(category.cycleLimit) ?? ''))
                setExpandedId(enabled ? null : category.id)
              }}
            />
          </div>
          {enabled && limit != null && (
            <div className="-mt-1.5 pb-3 pl-[3.75rem] pr-[3.75rem] sm:pl-16 sm:pr-16">
              <Meter
                size="sm"
                percent={percent}
                label={`${category.name} limit used this cycle`}
                valueHidden={hideSensitive}
                tone={status === 'OnTrack' ? 'bg-foreground/45' : METER_TONE[status]}
              />
            </div>
          )}

          {open && (
            <div id={editorId} className="animate-in fade-in px-4 pb-4 duration-150 sm:px-5">
              <div className="space-y-2 pl-11">
                <FormField
                  label={<><span className="sr-only">{category.name}</span>{' '}Limit per cycle</>}
                  required
                  error={error}
                >
                  {hideSensitive ? (
                    <div className="flex h-11 items-center rounded-control bg-surface-2/70 px-3 lg:h-10">
                      <SensitiveMask />
                    </div>
                  ) : (
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3 z-10 text-label text-muted-foreground">
                        {symbol}
                      </span>
                      <SmartAmountInput
                        type="text"
                        inputMode="decimal"
                        disabled={isSyncing}
                        value={draft ?? ''}
                        onChange={event => setDraft(category.id, event.target.value)}
                        placeholder="0.00"
                        className={cn('w-full pr-3 tabular-nums', symbol.length > 2 ? 'pl-12' : 'pl-9')}
                      />
                    </div>
                  )}
                </FormField>
                {!hideSensitive && suggested != null && suggested > 0 && (
                  <Button type="button" variant="tertiary" size="sm" className="-ml-3" onClick={() => setDraft(category.id, suggested.toFixed(2))}>
                    Use recent average ({symbol}{suggested.toFixed(2)})
                  </Button>
                )}
              </div>
            </div>
          )}
        </li>
      )
  }


  return (
    <section ref={sectionRef} id="category-limits-card" aria-labelledby={`${idPrefix}-heading`} className={cn(panelClass, '@container min-w-0 overflow-hidden')}>
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 id={`${idPrefix}-heading`} className="text-section text-foreground">Spending limits</h2>
          <p className="mt-0.5 text-caption text-muted-foreground">How much each category may spend in a cycle</p>
        </div>
        <Badge tone="neutral" className="mt-1 shrink-0">{trackedCount} tracked</Badge>
      </div>

      {spendingCategories.length === 0 ? (
        <p className="mx-4 mb-4 rounded-control bg-surface-2/70 p-3 text-caption text-muted-foreground sm:mx-5">
          Inflow categories do not use spending limits.
        </p>
      ) : saved.tracked.length > 0 && (
        <ul className="divide-y divide-border/60">
          {saved.tracked.map(renderRow)}
        </ul>
      )}

      {/* Categories without a limit fold under one row: a phone does not need to scroll past a
          dozen "No limit" switches to reach the ones that matter. Grouping follows what is saved,
          so a switch flipped here does not move its row until the change is kept. */}
      {saved.untracked.length > 0 && (
        <div className={cn(saved.tracked.length > 0 && 'border-t border-border/60')}>
          <Button
            variant="tertiary"
            type="button"
            onClick={() => setShowUntracked(open => !open)}
            aria-expanded={untrackedOpen}
            aria-controls={`${idPrefix}-untracked`}
            className="h-auto min-h-12 w-full justify-between rounded-none px-4 py-3 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground sm:px-5"
          >
            <span>{saved.tracked.length > 0 ? 'Without a limit' : 'Categories'} · {saved.untracked.length}</span>
            <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform duration-200', untrackedOpen && 'rotate-180')} />
          </Button>
          {untrackedOpen && (
            <ul id={`${idPrefix}-untracked`} className="divide-y divide-border/60 border-t border-border/60">
              {saved.untracked.map(renderRow)}
            </ul>
          )}
        </div>
      )}

      {/* With changes, Save travels with the list as a pill above the tab bar; without, it rests in
          the footer beside the note on when limits take effect. */}
      {hasChanges ? (
        <div className="glass-surface sticky bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-20 m-3 flex items-center gap-2 rounded-full p-2 pl-5 shadow-(--app-shadow-overlay) animate-in fade-in duration-150 sm:bottom-4">
          <span className="min-w-0 flex-1 truncate text-label font-medium text-foreground">
            {changedCategories.length} {changedCategories.length === 1 ? 'limit' : 'limits'} changed
          </span>
          <Button variant="tertiary" size="sm" type="button" onClick={discard}>Discard</Button>
          <Button type="button" size="sm" onClick={save} disabled={hideSensitive}>
            <Save className="size-3.5" aria-hidden="true" /> Save limits
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 sm:px-5">
          <p className="min-w-0 flex-[1_1_14rem] text-caption text-muted-foreground">
            Changes apply from this cycle on; earlier cycles keep their original limits.
          </p>
          <Button type="button" size="sm" onClick={save} disabled className="shrink-0">
            <Save className="size-3.5" aria-hidden="true" /> Save limits
          </Button>
        </div>
      )}
    </section>
  )
}
