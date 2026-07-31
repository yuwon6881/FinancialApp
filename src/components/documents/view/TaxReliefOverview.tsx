import { useState } from 'react'
import { Check, CheckCircle2, CircleDollarSign, Pencil, Plus, Save, X } from 'lucide-react'
import type { TaxReliefCategoryDefinition, TaxReliefCategorySummary, TaxYearReliefSummary } from '../../../types'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { useAppUi } from '../../../contexts/AppContext'
import { getErrorMessage } from '../../../lib/errors'
import { formatCurrencyVal } from '../../../lib/utils'

type CategoryInput = { name: string; limit: number; detail?: string }

const FIELD_CLASS = 'w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40'

interface TaxReliefOverviewProps {
  summary: TaxYearReliefSummary | null
  categories: TaxReliefCategoryDefinition[]
  taxYear?: number
  currency: string
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
  onAddCategory,
  onUpdateCategory,
}: TaxReliefOverviewProps) {
  const { showToast } = useAppUi()
  const [editorOpen, setEditorOpen] = useState(categories.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryInput>({ name: '', limit: 0, detail: '' })
  const [newCategory, setNewCategory] = useState<CategoryInput>({ name: '', limit: 0, detail: '' })
  const [isAdding, setIsAdding] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const selectedYear = summary?.taxYear ?? taxYear
  const trackerCategories = summary?.categories ?? categories.map(zeroSummary)
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
            onClick={() => setEditorOpen(open => !open)}
            className="self-start bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {editorOpen ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
            {editorOpen ? 'Close limits' : 'Manage limits'}
          </Button>
        )}
      </div>

      {inheritedDefaults && (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-[10px] text-muted-foreground">
          These are editable defaults inherited from the prior configured tax year. Your first change for YA {selectedYear} creates an independent copy.
        </p>
      )}

      {trackerCategories.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
          No categories are configured for this year yet. Add the limits you want to track below.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {trackerCategories.map(category => {
            const progress = category.limit > 0 ? Math.min(100, category.confirmedAmount / category.limit * 100) : 0
            const full = category.limit > 0 && progress >= 100
            return (
              <article key={category.id} className={`rounded-xl border p-2.5 ${full ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-border/60 bg-card'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] font-bold" title={category.name}>{category.name}</p>
                  {full && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-label="Relief limit reached" />}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-[10px] tabular-nums">
                  <span className="font-semibold text-foreground">{money(category.confirmedAmount)} used</span>
                  <span className="text-muted-foreground">{money(category.limit)} limit</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${category.name} confirmed amount`} aria-valuemin={0} aria-valuemax={category.limit} aria-valuenow={Math.min(category.confirmedAmount, category.limit)}>
                  <div className={`h-full rounded-full ${full ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-1.5 flex items-start justify-between gap-2 text-[9px]">
                  <span className={full ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                    {full ? 'Limit reached' : `${money(Math.max(0, category.limit - category.confirmedAmount))} room left`}
                  </span>
                  {category.pendingReviewAmount > 0 && <span className="text-right font-semibold text-amber-600 dark:text-amber-400">+{money(category.pendingReviewAmount)} review</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selectedYear !== undefined && editorOpen && (
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-3">
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
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                    <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Category</span><Input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} className={FIELD_CLASS} /></label>
                    <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Limit ({currency})</span><Input type="number" min="0" step="0.01" value={draft.limit} onChange={event => setDraft(current => ({ ...current, limit: Number(event.target.value) }))} className={`${FIELD_CLASS} tabular-nums`} /></label>
                    <div className="flex gap-1.5"><Button variant="primary" size="sm" type="button" onClick={() => void saveEdit(category.id)} disabled={savingId === category.id} className="py-2"><Save className="size-3.5" /> Save</Button><Button variant="unstyled" type="button" onClick={() => setEditingId(null)} aria-label="Cancel category edit" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></Button></div>
                    <label className="space-y-1 sm:col-span-3"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</span><Input value={draft.detail ?? ''} onChange={event => setDraft(current => ({ ...current, detail: event.target.value }))} maxLength={300} className={FIELD_CLASS} /></label>
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
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Category</span><Input autoFocus value={newCategory.name} onChange={event => setNewCategory(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Education" className={FIELD_CLASS} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Limit ({currency})</span><Input type="number" min="0" step="0.01" value={newCategory.limit} onChange={event => setNewCategory(current => ({ ...current, limit: Number(event.target.value) }))} className={`${FIELD_CLASS} tabular-nums`} /></label>
                <div className="flex gap-1.5"><Button variant="primary" size="sm" type="button" onClick={() => void addCategory()} disabled={isAdding && !newCategory.name.trim()} className="py-2"><Check className="size-3.5" /> Add</Button><Button variant="unstyled" type="button" onClick={() => { setIsAdding(false); setNewCategory({ name: '', limit: 0, detail: '' }) }} aria-label="Cancel adding category" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></Button></div>
                <label className="space-y-1 sm:col-span-3"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Note (optional)</span><Input value={newCategory.detail ?? ''} onChange={event => setNewCategory(current => ({ ...current, detail: event.target.value }))} maxLength={300} className={FIELD_CLASS} /></label>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Confirmed document amounts are tracking aids, not an eligibility determination. Sub-limits and personal conditions may apply.
      </p>
    </section>
  )
}
