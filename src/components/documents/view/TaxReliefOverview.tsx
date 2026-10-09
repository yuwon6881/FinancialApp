import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleDollarSign, Filter, Loader2, Pencil } from 'lucide-react'
import type { TaxReliefCategoryDefinition, TaxReliefCategorySummary, TaxYearReliefSummary } from '../../../types'
import { Button } from '../../ui/Button'
import { InteractiveCard } from '../../ui/InteractiveCard'
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
  selectedReliefCategories?: string[]
  onToggleReliefCategory: (categoryId: string) => void
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
    <section className={cn(panelClass, 'p-5')} aria-labelledby="tax-relief-overview">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="tax-relief-overview" className="flex items-center gap-2 text-subsection">
            <CircleDollarSign className="size-4 text-accent-ink" />
            {selectedYear ? `${selectedYear} tax relief tracker` : 'Tax relief tracker'}
          </h3>
          <p className="mt-1 text-caption text-muted-foreground">
            {summary
              ? `${money(summary.confirmedAmount)} confirmed${summary.pendingReviewAmount > 0 ? ` · ${money(summary.pendingReviewAmount)} waiting for review` : ''}`
              : 'Set your own categories and limits for the selected tax year.'}
          </p>
        </div>
        {selectedYear !== undefined && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={hideSensitive}
            onClick={() => setEditorOpen(true)}
            className="self-start"
          >
            <Pencil className="size-3.5" />
            Manage limits
          </Button>
        )}
      </div>

      <div className="mt-4" aria-busy={isLoading}>
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
          /* One row per category: what is used against the limit, as a bar and as figures. The row
             is also the filter toggle for the documents below. */
          <ul aria-label="Tax relief categories" className="-mx-2 space-y-0.5">
            {orderedTrackerCategories.map(category => {
              const progress = category.limit > 0 ? Math.min(100, category.confirmedAmount / category.limit * 100) : 0
              const full = category.limit > 0 && progress >= 100
              const selected = selectedReliefCategories.includes(category.id)
              return (
                <li key={category.id}>
                  <InteractiveCard
                    surface="plain"
                    onClick={() => onToggleReliefCategory(category.id)}
                    aria-pressed={selected}
                    aria-label={selected ? `Remove ${category.name} from the documents filter` : `Add ${category.name} to the documents filter`}
                    title={selected ? `Remove ${category.name} from the document filter` : `Filter documents by ${category.name}`}
                    className={cn(
                      'group grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-control px-2 py-2.5 text-left transition-colors sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_auto]',
                      selected ? 'bg-primary/8 ring-1 ring-inset ring-primary/40' : 'hover:bg-surface-2/70',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-body font-medium text-foreground" title={category.name}>{category.name}</span>
                      {selected
                        ? <Filter className="size-3 shrink-0 text-accent-ink" aria-hidden="true" />
                        : full && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-label="Relief limit reached" />}
                    </span>
                    <span className="text-right text-label tabular-nums sm:order-last">
                      <span className="font-semibold text-foreground">{money(category.confirmedAmount)}</span>
                      <span className="text-muted-foreground"> of {money(category.limit)}</span>
                    </span>
                    <span className="col-span-2 min-w-0 sm:col-span-1">
                      <Meter
                        percent={progress}
                        tone={full ? 'bg-emerald-500' : 'bg-primary'}
                        valueHidden={hideSensitive}
                        label={hideSensitive ? `${category.name} confirmed amount hidden` : `${category.name} confirmed amount`}
                      />
                      <span className="mt-1 flex flex-wrap justify-between gap-x-3 text-caption">
                        <span className={full ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                          {full ? 'Limit reached' : `${money(Math.max(0, category.limit - category.confirmedAmount))} room left`}
                        </span>
                        {category.pendingReviewAmount > 0 && <span className="font-medium text-amber-700 dark:text-amber-300">+{money(category.pendingReviewAmount)} review</span>}
                        {Boolean(category.otherCurrencyDocumentCount && category.otherCurrencyDocumentCount > 0) && (
                          <span className="text-muted-foreground">{category.otherCurrencyDocumentCount} not in {currency}</span>
                        )}
                      </span>
                    </span>
                  </InteractiveCard>
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
