import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleDollarSign, Filter, Loader2, Pencil } from 'lucide-react'
import type { TaxReliefCategoryDefinition, TaxReliefCategorySummary, TaxYearReliefSummary } from '../../../types'
import { Button } from '../../ui/Button'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { getErrorMessage } from '../../../lib/errors'
import { formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../../../lib/utils'
import { HorizontalRail } from '../../ui/HorizontalRail'
import { orderTaxReliefCategories } from '../../../lib/taxReliefOrdering'
import { mapServerErrorToField, type ServerFieldRule } from '../../../lib/formErrors'
import { revealFirstFieldError } from '../../ui/formValidation'
import { useSyncStatus } from '../../../lib/useOptimisticList'
import { TaxReliefLimitsSheet } from './TaxReliefLimitsSheet'

type CategoryInput = { name: string; limit: number }
type CategoryDraft = { name: string; limit: string }
type CategoryValidationErrors = { name?: string; limit?: string; form?: string }

const EMPTY_CATEGORY_DRAFT: CategoryDraft = { name: '', limit: '' }
const MAX_CATEGORY_NAME_LENGTH = 120
const MAX_CATEGORY_LIMIT = 1e15
const TAX_YEAR_LOOKBACK = 7

const SAVE_ERROR_RULES: ServerFieldRule<'name' | 'limit'>[] = [
  { field: 'name', match: ['already exists'], status: 409 },
  { field: 'name', match: ['details are invalid'], status: 400, message: 'Check the category name and limit, then try again.' },
]

const DELETE_ERROR_RULES: ServerFieldRule<'category'>[] = [
  { field: 'category', match: ['before deleting'], status: 409 },
  { field: 'category', match: [], status: 404, message: 'This category has already been removed. Close and reopen to refresh the list.' },
]

interface TaxReliefOverviewProps {
  summary: TaxYearReliefSummary | null
  categories: TaxReliefCategoryDefinition[]
  taxYear?: number
  currency: string
  isLoading: boolean
  selectedReliefCategories?: string[]
  onToggleReliefCategory: (categoryId: string) => void
  onAddCategory: (input: CategoryInput) => Promise<unknown>
  onUpdateCategory: (categoryId: string, input: CategoryInput) => Promise<unknown>
  onDeleteCategory: (categoryId: string) => Promise<unknown>
  activeSyncIds?: ReadonlyArray<string | number>
  deletingId?: string | number | null
}

function blockedDeleteReason(documentCount: number | undefined): string | null {
  if (!documentCount) return null
  return documentCount === 1
    ? 'Move the 1 document filed under this category to another one before deleting it.'
    : `Move the ${documentCount} documents filed under this category to another one before deleting it.`
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
  selectedReliefCategories = [],
  onToggleReliefCategory,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  activeSyncIds = [],
  deletingId: activeDeletingId,
}: TaxReliefOverviewProps) {
  const { showToast } = useAppUi()
  const { hideSensitive } = useAppPrefs()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_CATEGORY_DRAFT)
  const [newCategory, setNewCategory] = useState<CategoryDraft>(EMPTY_CATEGORY_DRAFT)
  const [draftErrors, setDraftErrors] = useState<CategoryValidationErrors>({})
  const [newCategoryErrors, setNewCategoryErrors] = useState<CategoryValidationErrors>({})
  const [isAdding, setIsAdding] = useState(false)
  const [isAddingBusy, setIsAddingBusy] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const sheetBodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hideSensitive) return
    setEditorOpen(false)
    setEditingId(null)
    setIsAdding(false)
    setIsAddingBusy(false)
    setConfirmingDeleteId(null)
    setDraftErrors({})
    setNewCategoryErrors({})
    setDeleteError(null)
  }, [hideSensitive])

  const selectedYear = summary?.taxYear ?? taxYear
  const currentYear = new Date().getFullYear()
  const isEditableTaxYear = selectedYear !== undefined
    && selectedYear <= currentYear
    && selectedYear >= currentYear - TAX_YEAR_LOOKBACK
  const summaryByCategory = new Map((summary?.categories ?? []).map(category => [category.id, category]))
  const trackerCategories = categories.map(category => ({
    ...zeroSummary(category),
    ...summaryByCategory.get(category.id),
    ...category,
  }))
  const orderedTrackerCategories = orderTaxReliefCategories(trackerCategories)
  const { isSyncing: isCategorySyncing, isDeleting: isCategoryDeleting } = useSyncStatus(
    categories,
    activeSyncIds,
    activeDeletingId,
  )
  const documentCountByCategory = new Map(
    (summary?.categories ?? []).map(category => [category.id, category.documentCount]),
  )
  const deleteBlockedById = new Map(categories.map(category => [category.id, blockedDeleteReason(documentCountByCategory.get(category.id))]))
  const inheritedDefaults = categories.length > 0 && categories.every(category => category.isInherited)
  const money = (value: number) => hideSensitive ? SENSITIVE_AMOUNT_MASK : formatCurrencyVal(value, currency)

  const beginEdit = (category: TaxReliefCategoryDefinition) => {
    setEditingId(category.id)
    setDraft({ name: category.name, limit: String(category.limit) })
    setDraftErrors({})
    setConfirmingDeleteId(null)
    setDeleteError(null)
  }

  const validate = (input: CategoryDraft, editingCategoryId?: string): { value: CategoryInput | null; errors: CategoryValidationErrors } => {
    const name = input.name.trim()
    const errors: CategoryValidationErrors = {}
    if (!name) errors.name = 'Category name is required.'
    else if (name.length > MAX_CATEGORY_NAME_LENGTH) errors.name = `Category names must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`

    const rawLimit = input.limit.trim()
    const limit = Number(rawLimit)
    if (!rawLimit || !Number.isFinite(limit) || limit < 0) errors.limit = 'Enter a non-negative limit.'
    else if (limit > MAX_CATEGORY_LIMIT) errors.limit = 'That limit is larger than this tracker supports.'

    if (!isEditableTaxYear) {
      errors.form = `Only tax years ${currentYear - TAX_YEAR_LOOKBACK} to ${currentYear} can be edited.`
    }

    const normalizedName = name.toLowerCase()
    if (
      name
      && categories.some(category => category.id !== editingCategoryId && category.name.trim().toLowerCase() === normalizedName)
    ) {
      errors.name = 'A category with this name already exists.'
    }

    return Object.keys(errors).length > 0 ? { value: null, errors } : { value: { name, limit }, errors: {} }
  }

  const saveEdit = async (categoryId: string) => {
    const validation = validate(draft, categoryId)
    if (!validation.value) {
      setDraftErrors(validation.errors)
      revealFirstFieldError(sheetBodyRef)
      return
    }
    const input = validation.value
    setDraftErrors({})
    setSavingId(categoryId)
    try {
      await onUpdateCategory(categoryId, input)
      setEditingId(null)
    } catch (error) {
      const mapped = mapServerErrorToField(error, SAVE_ERROR_RULES)
      if (mapped) {
        setDraftErrors({ [mapped.field]: mapped.message })
        revealFirstFieldError(sheetBodyRef)
        return
      }
      showToast(getErrorMessage(error, 'The tax relief category could not be updated.'), 'Tax relief update failed', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const addCategory = async () => {
    const validation = validate(newCategory)
    if (!validation.value) {
      setNewCategoryErrors(validation.errors)
      revealFirstFieldError(sheetBodyRef)
      return
    }
    const input = validation.value
    setNewCategoryErrors({})
    setIsAddingBusy(true)
    try {
      await onAddCategory(input)
      setNewCategory(EMPTY_CATEGORY_DRAFT)
    } catch (error) {
      const mapped = mapServerErrorToField(error, SAVE_ERROR_RULES)
      if (mapped) {
        setNewCategoryErrors({ [mapped.field]: mapped.message })
        revealFirstFieldError(sheetBodyRef)
        return
      }
      showToast(getErrorMessage(error, 'The tax relief category could not be added.'), 'Tax relief add failed', 'error')
    } finally {
      setIsAddingBusy(false)
    }
  }

  const deleteCategory = async (category: TaxReliefCategoryDefinition) => {
    const blocked = deleteBlockedById.get(category.id) ?? null
    if (blocked) {
      setDeleteError({ id: category.id, message: blocked })
      return
    }
    setDeleteError(null)
    setDeletingId(category.id)
    try {
      await onDeleteCategory(category.id)
      setConfirmingDeleteId(null)
      if (editingId === category.id) setEditingId(null)
    } catch (error) {
      const mapped = mapServerErrorToField(error, DELETE_ERROR_RULES)
      if (mapped) {
        setDeleteError({ id: category.id, message: mapped.message })
        revealFirstFieldError(sheetBodyRef)
        return
      }
      showToast(getErrorMessage(error, 'The tax relief category could not be deleted.'), 'Tax relief delete failed', 'error')
    } finally {
      setDeletingId(null)
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
          <p className="mt-1 text-xs text-muted-foreground">
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
            disabled={hideSensitive}
            onClick={() => setEditorOpen(true)}
            className="self-start bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3.5" />
            Manage limits
          </Button>
        )}
      </div>

      {inheritedDefaults && (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs text-muted-foreground">
          These are editable defaults inherited from the prior configured tax year. Your first change for YA {selectedYear} creates an independent copy.
        </p>
      )}

      <div className="mt-4 min-h-[8.25rem]" aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex min-h-[8.25rem] items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/60 text-xs font-semibold text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
            Loading tax relief tracker…
          </div>
        ) : trackerCategories.length === 0 ? (
          <p className="flex min-h-[8.25rem] items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No categories are configured for this year yet. Use Manage limits to add the limits you want to track.
          </p>
        ) : (
          <HorizontalRail label="Tax relief categories" className="items-stretch" showControls>
            {orderedTrackerCategories.map(category => {
              const progress = category.limit > 0 ? Math.min(100, category.confirmedAmount / category.limit * 100) : 0
              const full = category.limit > 0 && progress >= 100
              const selected = selectedReliefCategories.includes(category.id)
              return (
                <Button
                  variant="unstyled"
                  key={category.id}
                  type="button"
                  onClick={() => onToggleReliefCategory(category.id)}
                  aria-pressed={selected}
                  aria-label={selected ? `Remove ${category.name} from the documents filter` : `Add ${category.name} to the documents filter`}
                  title={selected ? `Remove ${category.name} from the document filter` : `Filter documents by ${category.name}`}
                  className={`group flex min-h-32 w-full sm:w-[22rem] shrink-0 cursor-pointer snap-start flex-col gap-3 rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    full
                      ? 'border-emerald-500/45 bg-emerald-500/10 hover:border-emerald-500/70 hover:bg-emerald-500/14'
                      : 'border-border/60 bg-card hover:border-primary/45 hover:bg-muted/60'
                  } ${
                    selected ? 'ring-2 ring-inset ring-primary/80 shadow-md shadow-primary/10' : 'hover:shadow-md hover:shadow-primary/5'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-bold text-foreground" title={category.name}>{category.name}</p>
                    <span className="flex shrink-0 items-center gap-1.5 transition">
                      {selected && (
                        <span className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-accent-ink">
                          <Filter className="size-2.5" aria-hidden="true" />
                          Filtering
                        </span>
                      )}
                      {full
                        ? <CheckCircle2 className="size-3.5 text-emerald-500" aria-label="Relief limit reached" />
                        : !selected && <Filter className="size-3.5 text-muted-foreground/30 transition group-hover:text-accent-ink" aria-hidden="true" />}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
                      <span className="font-semibold text-foreground">{money(category.confirmedAmount)} used</span>
                      <span className="text-muted-foreground">{money(category.limit)} limit</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={hideSensitive ? `${category.name} confirmed amount hidden` : `${category.name} confirmed amount`} aria-valuemin={hideSensitive ? undefined : 0} aria-valuemax={hideSensitive ? undefined : category.limit} aria-valuenow={hideSensitive ? undefined : Math.min(category.confirmedAmount, category.limit)}>
                      <div className={`h-full rounded-full transition-all duration-500 ${full ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="mt-auto flex items-start justify-between gap-2 text-xs">
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
        <TaxReliefLimitsSheet
          isOpen={editorOpen}
          onClose={() => {
            setEditorOpen(false)
            setEditingId(null)
            setIsAdding(false)
            setConfirmingDeleteId(null)
            setDraftErrors({})
            setNewCategoryErrors({})
            setDeleteError(null)
            setDraft(EMPTY_CATEGORY_DRAFT)
            setNewCategory(EMPTY_CATEGORY_DRAFT)
          }}
          selectedYear={selectedYear}
          categories={categories}
          editingId={editingId}
          setEditingId={setEditingId}
          draft={draft}
          setDraft={setDraft}
          draftErrors={draftErrors}
          setDraftErrors={setDraftErrors}
          savingId={savingId}
          onSaveEdit={saveEdit}
          confirmingDeleteId={confirmingDeleteId}
          setConfirmingDeleteId={setConfirmingDeleteId}
          deletingId={deletingId}
          deleteBlockedById={deleteBlockedById}
          deleteError={deleteError}
          setDeleteError={setDeleteError}
          onDeleteCategory={deleteCategory}
          onBeginEdit={beginEdit}
          isAdding={isAdding}
          setIsAdding={setIsAdding}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          newCategoryErrors={newCategoryErrors}
          setNewCategoryErrors={setNewCategoryErrors}
          isAddingBusy={isAddingBusy}
          onAddCategory={addCategory}
          currency={currency}
          money={money}
          isCategorySyncing={isCategorySyncing}
          isCategoryDeleting={isCategoryDeleting}
          sheetBodyRef={sheetBodyRef}
        />
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Confirmed document amounts are tracking aids, not an eligibility determination. Sub-limits and personal conditions may apply.
      </p>
    </section>
  )
}
