import { useState } from 'react'
import { Check, CheckCircle2, CircleDollarSign, Filter, Loader2, Pencil, Plus, Save, X } from 'lucide-react'
import type { TaxReliefCategoryDefinition, TaxReliefCategorySummary, TaxYearReliefSummary } from '../../../types'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { BottomSheet } from '../../ui/BottomSheet'
import { useAppUi } from '../../../contexts/AppContext'
import { getErrorMessage } from '../../../lib/errors'
import { formatCurrencyVal } from '../../../lib/utils'
import { HorizontalRail } from '../../ui/HorizontalRail'
import { orderTaxReliefCategories } from '../../../lib/taxReliefOrdering'

type CategoryInput = { name: string; limit: number; detail?: string }

const FIELD_CLASS = 'w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40'

interface TaxReliefOverviewProps {
  summary: TaxYearReliefSummary | null
  categories: TaxReliefCategoryDefinition[]
  taxYear?: number
  currency: string
  isLoading: boolean
  selectedReliefCategory?: string
  onSelectReliefCategory: (categoryId: string | undefined) => void
  onAddCategory: (input: CategoryInput) => Promise<unknown>
  onUpdateCategory: (categoryId: string, input: CategoryInput) => Promise<unknown>
}

function zeroSummary(category: TaxReliefCategoryDefinition): TaxReliefCategorySummary {
  return {
    ...category,
    confirmedAmount: 0,
    pendingReviewAmount: 0,
    documentCount: 0,
    pendingReviewCount: 0,
  }
}

export function TaxReliefOverview({
  summary,
  categories,
  taxYear,
  currency,
  isLoading,
  selectedReliefCategory,
  onSelectReliefCategory,
  onAddCategory,
  onUpdateCategory,
}: TaxReliefOverviewProps) {
  const { showToast } = useAppUi()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryInput>({ name: '', limit: 0, detail: '' })
  const [newCategory, setNewCategory] = useState<CategoryInput>({ name: '', limit: 0, detail: '' })
  const [isAdding, setIsAdding] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const selectedYear = summary?.taxYear ?? taxYear
  const trackerCategories = summary?.categories ?? categories.map(zeroSummary)
  const orderedTrackerCategories = orderTaxReliefCategories(trackerCategories)
  const inheritedDefaults = categories.length > 0 && categories.every(category => category.isInherited)
  const money = (value: number) => formatCurrencyVal(value, currency)

  const beginEdit = (category: TaxReliefCategoryDefinition) => {
    setEditingId(category.id)
    setDraft({ name: category.name, limit: category.limit, detail: category.detail })
  }

  const validate = (input: CategoryInput): CategoryInput | null => {
    const name = input.name.trim()
    const limit = Number(input.limit)
    if (!name || name.length > 120 || !Number.isFinite(limit) || limit < 0) return null
    return { name, limit, detail: input.detail?.trim() ?? '' }
  }

  const saveEdit = async (categoryId: string) => {
    const input = validate(draft)
    if (!input) {
      showToast('Enter a category name and a non-negative limit.', 'Invalid limit', 'error')
      return
    }
    setSavingId(categoryId)
    try {
      await onUpdateCategory(categoryId, input)
      setEditingId(null)
      showToast(`"${input.name}" was updated for YA ${selectedYear}.`, 'Tax relief updated', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'The tax relief category could not be updated.'), 'Tax relief update failed', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const addCategory = async () => {
    const input = validate(newCategory)
    if (!input) {
      showToast('Enter a category name and a non-negative limit.', 'Invalid limit', 'error')
      return
    }
    setIsAdding(true)
    try {
      await onAddCategory(input)
      setNewCategory({ name: '', limit: 0, detail: '' })
      showToast(`"${input.name}" was added for YA ${selectedYear}.`, 'Tax relief category added', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'The tax relief category could not be added.'), 'Tax relief add failed', 'error')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-border/60 bg-muted/20 p-4" aria-labelledby="tax-relief-overview">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="tax-relief-overview" className="flex items-center gap-2 text-sm font-black">
            <CircleDollarSign className="size-4 text-accent-ink" />
            {selectedYear ? `${selectedYear} tax relief tracker` : 'Tax relief tracker'}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {summary
              ? `${money(summary.confirmedAmount)} confirmed${summary.pendingReviewAmount > 0 ? ` · ${money(summary.pendingReviewAmount)} waiting for review` : ''}`
              : 'Set your own categories and limits for the selected tax year.'}
          </p>
        </div>
        {selectedYear !== undefined && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setEditorOpen(true)}
            className="self-start bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
            Manage limits
          </Button>
        )}
      </div>

      {inheritedDefaults && (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-[10px] text-muted-foreground">
          These are editable defaults inherited from the prior configured tax year. Your first change for YA {selectedYear} creates an independent copy.
        </p>
      )}

      <div className="mt-4 min-h-[8.25rem]" aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex min-h-[8.25rem] items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/60 text-[11px] font-semibold text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
            Loading tax relief tracker…
          </div>
        ) : trackerCategories.length === 0 ? (
          <p className="flex min-h-[8.25rem] items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
            No categories are configured for this year yet. Use Manage limits to add the limits you want to track.
          </p>
        ) : (
          <HorizontalRail label="Tax relief categories" className="items-stretch">
            {orderedTrackerCategories.map(category => {
              const progress = category.limit > 0 ? Math.min(100, category.confirmedAmount / category.limit * 100) : 0
              const full = category.limit > 0 && progress >= 100
              const selected = selectedReliefCategory === category.id
              return (
                <Button
                  variant="unstyled"
                  key={category.id}
                  type="button"
                  onClick={() => onSelectReliefCategory(selected ? undefined : category.id)}
                  aria-pressed={selected}
                  aria-label={selected ? `Clear documents filter for ${category.name}` : `Filter documents by ${category.name}`}
                  title={selected ? `Clear ${category.name} document filter` : `Filter documents by ${category.name}`}
                  className={`group flex min-h-32 w-[22rem] shrink-0 cursor-pointer snap-start flex-col gap-3 rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    selected
                      ? 'border-primary/70 bg-primary/10 ring-1 ring-primary/25 shadow-md shadow-primary/5'
                      : full
                        ? 'border-emerald-500/30 bg-emerald-500/8 hover:border-emerald-500/60 hover:bg-emerald-500/12 hover:shadow-md hover:shadow-emerald-500/5'
                        : 'border-border/60 bg-card hover:border-primary/45 hover:bg-muted/60 hover:shadow-md hover:shadow-primary/5'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-bold text-foreground" title={category.name}>{category.name}</p>
                    <span className={`shrink-0 transition ${selected ? 'text-primary' : full ? 'text-emerald-500' : 'text-muted-foreground/30 group-hover:text-primary'}`}>
                      {selected ? <Filter className="size-3.5" aria-hidden="true" /> : full ? <CheckCircle2 className="size-3.5" aria-label="Relief limit reached" /> : <Filter className="size-3.5" aria-hidden="true" />}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2 text-[10px] tabular-nums">
                      <span className="font-semibold text-foreground">{money(category.confirmedAmount)} used</span>
                      <span className="text-muted-foreground">{money(category.limit)} limit</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${category.name} confirmed amount`} aria-valuemin={0} aria-valuemax={category.limit} aria-valuenow={Math.min(category.confirmedAmount, category.limit)}>
                      <div className={`h-full rounded-full transition-all duration-500 ${full ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="mt-auto flex items-start justify-between gap-2 text-[9px]">
                    <span className={full ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                      {full ? 'Limit reached' : `${money(Math.max(0, category.limit - category.confirmedAmount))} room left`}
                    </span>
                    {category.pendingReviewAmount > 0 && <span className="text-right font-semibold text-amber-600 dark:text-amber-400">+{money(category.pendingReviewAmount)} review</span>}
                  </div>
                </Button>
              )
            })}
          </HorizontalRail>
        )}
      </div>

      {selectedYear !== undefined && editorOpen && (
        <BottomSheet
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false)
            setEditingId(null)
            setIsAdding(false)
            setNewCategory({ name: '', limit: 0, detail: '' })
          }}
          title={`Manage tax relief limits for YA ${selectedYear}`}
          maxWidthClassName="max-w-2xl"
        >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-black">Categories and limits for YA {selectedYear}</h4>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Only this year changes. Amounts marked for review are never counted as confirmed.</p>
            </div>
            {!isAdding && (
              <Button variant="outline" size="sm" type="button" onClick={() => setIsAdding(true)} className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Plus className="size-3.5" /> Add category
              </Button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {categories.map(category => (
              <div key={category.id} className="rounded-lg border border-border/60 p-2.5">
                {editingId === category.id ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Category</span><Input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} className={FIELD_CLASS} /></label>
                    <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Limit ({currency})</span><Input type="number" min="0" step="0.01" value={draft.limit} onChange={event => setDraft(current => ({ ...current, limit: Number(event.target.value) }))} className={`${FIELD_CLASS} tabular-nums`} /></label>
                    <label className="space-y-1 sm:col-span-2"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</span><Input value={draft.detail ?? ''} onChange={event => setDraft(current => ({ ...current, detail: event.target.value }))} maxLength={300} className={FIELD_CLASS} /></label>
                    <div className="flex justify-end gap-1.5 sm:col-span-2"><Button variant="primary" size="sm" type="button" onClick={() => void saveEdit(category.id)} disabled={savingId === category.id} className="py-2"><Save className="size-3.5" /> Save</Button><Button variant="unstyled" type="button" onClick={() => setEditingId(null)} aria-label="Close category editor" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></Button></div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{category.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{money(category.limit)} limit{category.detail ? ` · ${category.detail}` : ''}{category.isInherited ? ' · inherited default' : ''}</p></div>
                    <Button variant="outline" size="sm" type="button" onClick={() => beginEdit(category)} className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-3" /> Edit</Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isAdding && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Category</span><Input autoFocus value={newCategory.name} onChange={event => setNewCategory(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Education" className={FIELD_CLASS} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Limit ({currency})</span><Input type="number" min="0" step="0.01" value={newCategory.limit} onChange={event => setNewCategory(current => ({ ...current, limit: Number(event.target.value) }))} className={`${FIELD_CLASS} tabular-nums`} /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</span><Input value={newCategory.detail ?? ''} onChange={event => setNewCategory(current => ({ ...current, detail: event.target.value }))} maxLength={300} className={FIELD_CLASS} /></label>
                <div className="flex justify-end gap-1.5 sm:col-span-2"><Button variant="primary" size="sm" type="button" onClick={() => void addCategory()} disabled={isAdding && !newCategory.name.trim()} className="py-2"><Check className="size-3.5" /> Add</Button><Button variant="unstyled" type="button" onClick={() => { setIsAdding(false); setNewCategory({ name: '', limit: 0, detail: '' }) }} aria-label="Close add category form" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></Button></div>
              </div>
            </div>
          )}
        </div>
        </BottomSheet>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Confirmed document amounts are tracking aids, not an eligibility determination. Sub-limits and personal conditions may apply.
      </p>
    </section>
  )
}
