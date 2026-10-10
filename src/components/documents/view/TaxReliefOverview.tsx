import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, Filter, Loader2, Pencil } from 'lucide-react'
import type { TaxReliefCategoryDefinition, TaxReliefCategorySummary, TaxYearReliefSummary } from '../../../types'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { useAppPrefs, useAppUi } from '../../../contexts/AppContext'
import { getErrorMessage } from '../../../lib/errors'
import { cn, formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../../../lib/utils'
import { orderTaxReliefCategories } from '../../../lib/taxReliefOrdering'
import { mapServerErrorToField, type ServerFieldRule } from '../../../lib/formErrors'
import { focusFirstInvalidField } from '../../ui/formValidation'
import { useSyncStatus } from '../../../lib/useOptimisticList'
import { TaxReliefLimitsSheet } from './TaxReliefLimitsSheet'
import { Meter } from '../../ui/Meter'
import { panelClass } from '../../ui/panelStyles'

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
  /** The relief categories the document list is currently narrowed to, marked on their rows. */
  selectedReliefCategories?: string[]
  /** Narrows the document list to one category and brings it into view (the row's "n docs" link). */
  onShowReliefDocuments: (categoryId: string) => void
  onAddCategory: (input: CategoryInput) => Promise<unknown>
  onUpdateCategory: (categoryId: string, input: CategoryInput) => Promise<unknown>
  onDeleteCategory: (categoryId: string) => Promise<unknown>
  activeSyncIds?: ReadonlyArray<string | number>
  deletingId?: string | number | null
}

function blockedDeleteReason(summary: TaxReliefCategorySummary | undefined): string | null {
  if (!summary || !summary.documentCount) return null
  const count = summary.documentCount
  const otherCount = summary.otherCurrencyDocumentCount ?? 0
  const otherNote = otherCount > 0
    ? ` (${otherCount} in other ${otherCount === 1 ? 'currency' : 'currencies'})`
    : ''
  return count === 1
    ? `Move the 1 document${otherNote} filed under this category to another one before deleting it.`
    : `Move the ${count} documents${otherNote} filed under this category to another one before deleting it.`
}

function zeroSummary(category: TaxReliefCategoryDefinition): TaxReliefCategorySummary {
  return {
    ...category,
    confirmedAmount: 0,
    pendingReviewAmount: 0,
    documentCount: 0,
    pendingReviewCount: 0,
    otherCurrencyDocumentCount: 0,
  }
}

export function TaxReliefOverview({
  summary,
  categories,
  taxYear,
  currency,
  isLoading,
  selectedReliefCategories = [],
  onShowReliefDocuments,
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
  const deleteBlockedById = new Map(categories.map(category => [category.id, blockedDeleteReason(summaryByCategory.get(category.id))]))
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
      focusFirstInvalidField(sheetBodyRef)
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
        focusFirstInvalidField(sheetBodyRef)
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
      focusFirstInvalidField(sheetBodyRef)
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
        focusFirstInvalidField(sheetBodyRef)
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
        focusFirstInvalidField(sheetBodyRef)
        return
      }
      showToast(getErrorMessage(error, 'The tax relief category could not be deleted.'), 'Tax relief delete failed', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={cn(panelClass, '@container p-4 sm:p-5')} aria-labelledby="tax-relief-overview">
      <div className="flex items-center justify-between gap-3">
        <h3 id="tax-relief-overview" className="min-w-0 text-subsection text-foreground">
          {selectedYear ? `${selectedYear} tax relief` : 'Tax relief'}
        </h3>
        {selectedYear !== undefined && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={hideSensitive}
            onClick={() => setEditorOpen(true)}
            className="-my-1 shrink-0"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Manage limits
          </Button>
        )}
      </div>
      <p className="mt-0.5 text-caption text-muted-foreground">
        {summary
          ? <>
              <span className="font-medium text-foreground tabular-nums">{money(summary.confirmedAmount)}</span> claimed
              {summary.pendingReviewAmount > 0 && <> · <span className="whitespace-nowrap text-amber-700 dark:text-amber-300">{money(summary.pendingReviewAmount)} to review</span></>}
            </>
          : 'Set your own categories and limits for the selected tax year.'}
      </p>

      <div className="mt-3" aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-control bg-surface-2/70 text-caption font-semibold text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin text-accent-ink" aria-hidden="true" />
            Loading tax relief tracker…
          </div>
        ) : trackerCategories.length === 0 ? (
          <p className="rounded-control bg-surface-2/70 px-3.5 py-3 text-label text-muted-foreground dark:bg-surface-3/70">
            No categories yet. Use Manage limits to add the reliefs you claim.
          </p>
        ) : (
          /* One row per category: what is claimed against the limit, as a bar and as figures. The
             row itself is not a control any more -- it used to be the documents filter, which
             nothing on screen said. Its one action is the explicit "n docs" link at the end. */
          <ul aria-label="Tax relief categories" className="divide-y divide-border/60">
            {orderedTrackerCategories.map(category => {
              const progress = category.limit > 0 ? Math.min(100, category.confirmedAmount / category.limit * 100) : 0
              const full = category.limit > 0 && progress >= 100
              const filtered = selectedReliefCategories.includes(category.id)
              const count = category.documentCount ?? 0
              return (
                <li
                  key={category.id}
                  data-filtered={filtered || undefined}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 @2xl:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_auto_6.5rem] @2xl:gap-x-5"
                >
                  {/* Name and claimed figure share the first line on a phone; from @2xl they are
                      columns either side of the bar. */}
                  <div className="flex min-w-0 items-baseline justify-between gap-3 @2xl:contents">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-body font-medium text-foreground" title={category.name}>{category.name}</span>
                      {full && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Relief limit reached" />}
                      {filtered && (
                        <Badge tone="accent" className="shrink-0">
                          <Filter className="size-3" aria-hidden="true" />
                          Filtering
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-label tabular-nums @2xl:order-3">
                      <span className="font-semibold text-foreground">{money(category.confirmedAmount)}</span>
                      <span className="hidden text-muted-foreground @2xl:inline"> of {money(category.limit)}</span>
                    </span>
                  </div>
                  <div className="col-start-1 mt-1.5 min-w-0 @2xl:col-start-auto @2xl:order-2 @2xl:mt-0">
                    <Meter
                      size="sm"
                      percent={progress}
                      tone={full ? 'bg-emerald-500' : 'bg-primary'}
                      valueHidden={hideSensitive}
                      label={hideSensitive ? `${category.name} confirmed amount hidden` : `${category.name} confirmed amount`}
                    />
                    <p className="mt-1 flex flex-wrap gap-x-2 text-caption text-muted-foreground">
                      <span className={full ? 'font-medium text-emerald-600 dark:text-emerald-400' : undefined}>
                        {full ? 'Limit reached' : `${money(Math.max(0, category.limit - category.confirmedAmount))} left`}
                        <span className="@2xl:hidden"> of {money(category.limit)}</span>
                      </span>
                      {category.pendingReviewAmount > 0 && <span className="font-medium text-amber-700 dark:text-amber-300">+{money(category.pendingReviewAmount)} review</span>}
                      {Boolean(category.otherCurrencyDocumentCount && category.otherCurrencyDocumentCount > 0) && (
                        <span>{category.otherCurrencyDocumentCount} not in {currency}</span>
                      )}
                    </p>
                  </div>
                  <div className="col-start-2 row-span-2 row-start-1 flex justify-end @2xl:order-4 @2xl:col-start-auto @2xl:row-span-1 @2xl:row-start-auto">
                    {count > 0 ? (
                      <Button
                        variant="tertiary"
                        size="sm"
                        type="button"
                        onClick={() => onShowReliefDocuments(category.id)}
                        aria-label={`Show ${count} ${count === 1 ? 'doc' : 'docs'} in ${category.name}`}
                        className="-mr-2 gap-0.5 px-2.5 text-accent-ink hover:text-accent-ink"
                      >
                        <span className="tabular-nums">{count} {count === 1 ? 'doc' : 'docs'}</span>
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <span className="px-0.5 text-caption text-muted-foreground">No docs</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
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

      <p className="mt-3 text-caption leading-relaxed text-muted-foreground">
        Tracking aid only; tax rules may also apply.
      </p>
    </section>
  )
}
