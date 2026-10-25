import React from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { TaxReliefCategoryDefinition } from '../../../types'
import { BottomSheet } from '../../ui/BottomSheet'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Badge } from '../../ui/Badge'
import { ModalActions } from '../../ui/ModalActions'
import { RowSyncStatus } from '../../ui/RowSyncBadge'
import { cn } from '../../../lib/utils'

export interface TaxReliefLimitsSheetProps {
  isOpen: boolean
  onClose: () => void
  selectedYear?: number
  categories: TaxReliefCategoryDefinition[]
  editingId: string | null
  setEditingId: (id: string | null) => void
  draft: { name: string; limit: string }
  setDraft: React.Dispatch<React.SetStateAction<{ name: string; limit: string }>>
  draftErrors: { name?: string; limit?: string; form?: string }
  setDraftErrors: React.Dispatch<React.SetStateAction<{ name?: string; limit?: string; form?: string }>>
  savingId: string | null
  onSaveEdit: (categoryId: string) => Promise<void>
  confirmingDeleteId: string | null
  setConfirmingDeleteId: (id: string | null) => void
  deletingId: string | null
  deleteBlockedById: Map<string, string | null>
  deleteError: { id: string; message: string } | null
  setDeleteError: (error: { id: string; message: string } | null) => void
  onDeleteCategory: (category: TaxReliefCategoryDefinition) => Promise<void>
  onBeginEdit: (category: TaxReliefCategoryDefinition) => void
  isAdding: boolean
  setIsAdding: (adding: boolean) => void
  newCategory: { name: string; limit: string }
  setNewCategory: React.Dispatch<React.SetStateAction<{ name: string; limit: string }>>
  newCategoryErrors: { name?: string; limit?: string; form?: string }
  setNewCategoryErrors: React.Dispatch<React.SetStateAction<{ name?: string; limit?: string; form?: string }>>
  isAddingBusy: boolean
  onAddCategory: () => Promise<void>
  currency: string
  money: (value: number) => string
  isCategorySyncing: (id: string) => boolean
  isCategoryDeleting: (id: string) => boolean
  sheetBodyRef: React.RefObject<HTMLDivElement | null>
}

const EMPTY_CATEGORY_DRAFT = { name: '', limit: '' }

type Draft = { name: string; limit: string }
type DraftErrors = { name?: string; limit?: string; form?: string }

/** The name-and-limit pair, shared by editing a relief and adding one so the two cannot drift. */
function CategoryFields({
  draft,
  errors,
  currency,
  autoFocus,
  onChange,
}: {
  draft: Draft
  errors: DraftErrors
  currency: string
  autoFocus?: boolean
  onChange: (field: keyof Draft, value: string) => void
}) {
  return (
    <>
      <FormField label="Category" required error={errors.name}>
        <Input autoFocus={autoFocus} value={draft.name} onChange={event => onChange('name', event.target.value)} placeholder="e.g. Education" controlSize="sm" />
      </FormField>
      <FormField label={`Limit (${currency})`} required error={errors.limit}>
        <Input type="number" min="0" step="0.01" inputMode="decimal" value={draft.limit} onChange={event => onChange('limit', event.target.value)} controlSize="sm" className="tabular-nums" />
      </FormField>
      {errors.form && <p role="alert" className="text-caption font-semibold text-destructive sm:col-span-2">{errors.form}</p>}
    </>
  )
}

/**
 * The reliefs a tax year tracks and the limit of each. One list, one row per relief: a row reads as
 * its name and limit until it is edited in place, and adding a relief is the list's last row rather
 * than a separate form above it.
 */
export const TaxReliefLimitsSheet: React.FC<TaxReliefLimitsSheetProps> = ({
  isOpen,
  onClose,
  selectedYear,
  categories,
  editingId,
  setEditingId,
  draft,
  setDraft,
  draftErrors,
  setDraftErrors,
  savingId,
  onSaveEdit,
  confirmingDeleteId,
  setConfirmingDeleteId,
  deletingId,
  deleteBlockedById,
  deleteError,
  setDeleteError,
  onDeleteCategory,
  onBeginEdit,
  isAdding,
  setIsAdding,
  newCategory,
  setNewCategory,
  newCategoryErrors,
  setNewCategoryErrors,
  isAddingBusy,
  onAddCategory,
  currency,
  money,
  isCategorySyncing,
  isCategoryDeleting,
  sheetBodyRef,
}) => {
  const totalLimit = categories.reduce((total, category) => total + category.limit, 0)
  const closeAdd = () => { setIsAdding(false); setNewCategory(EMPTY_CATEGORY_DRAFT); setNewCategoryErrors({}) }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Tax relief limits · YA ${selectedYear}`}
      description={categories.length > 0
        ? `${categories.length} relief${categories.length === 1 ? '' : 's'} · ${money(totalLimit)} in total`
        : 'Add the reliefs you claim and the most each one allows.'}
      maxWidthClassName="max-w-2xl"
      footer={<ModalActions><Button variant="secondary" onClick={onClose}>Done</Button></ModalActions>}
    >
      <div ref={sheetBodyRef}>
        <ul aria-label={`Tax relief categories for YA ${selectedYear}`} className="divide-y divide-border/60 overflow-hidden rounded-control ring-1 ring-border/60">
          {categories.map(category => {
            const isEditing = editingId === category.id
            const isDraftChanged = isEditing && (
              draft.name.trim() !== category.name ||
              (draft.limit.trim() !== '' && !Number.isNaN(Number(draft.limit)) && Number(draft.limit) !== category.limit)
            )
            const blocked = deleteBlockedById.get(category.id)

            return (
              <li
                key={category.id}
                className={cn('px-3 py-2.5 transition-colors sm:px-4', isEditing && 'bg-surface-2/60 dark:bg-surface-3/40', isDraftChanged && 'ring-2 ring-inset ring-primary/50')}
              >
                {isEditing ? (
                  <div className="grid gap-3 py-1 sm:grid-cols-2">
                    <CategoryFields
                      draft={draft}
                      errors={draftErrors}
                      currency={currency}
                      onChange={(field, value) => {
                        setDraft(current => ({ ...current, [field]: value }))
                        setDraftErrors(current => ({ ...current, [field]: undefined }))
                      }}
                    />
                    <div className="flex items-center justify-end gap-2 sm:col-span-2">
                      {isDraftChanged && (
                        <span className="mr-auto flex items-center gap-1.5 text-caption font-semibold text-accent-ink">
                          <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden="true" />
                          Unsaved changes
                        </span>
                      )}
                      <Button variant="tertiary" size="sm" onClick={() => setEditingId(null)} aria-label="Close category editor">Cancel</Button>
                      <Button size="sm" onClick={() => void onSaveEdit(category.id)} loading={savingId === category.id}>Save</Button>
                    </div>
                  </div>
                ) : confirmingDeleteId === category.id ? (
                  <div className="space-y-2 py-0.5">
                    <p className="text-body text-foreground">
                      Delete <span className="font-semibold">{category.name}</span> from YA {selectedYear}?
                    </p>
                    {(deleteError?.id === category.id ? deleteError.message : blocked) && (
                      <p role="alert" className="text-caption font-semibold text-destructive">
                        {deleteError?.id === category.id ? deleteError.message : blocked}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="tertiary" size="sm" onClick={() => { setConfirmingDeleteId(null); setDeleteError(null) }}>Cancel</Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void onDeleteCategory(category)}
                        disabled={deletingId === category.id || Boolean(blocked)}
                        title={blocked ?? undefined}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" /> Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-body font-medium text-foreground">{category.name}</p>
                        {category.isInherited && <Badge className="shrink-0">Default</Badge>}
                        <RowSyncStatus
                          entityLabel="tax relief category"
                          isDeleting={isCategoryDeleting(category.id)}
                          isSyncing={isCategorySyncing(category.id)}
                          isPending={category.isPendingSync && !isCategorySyncing(category.id)}
                        />
                      </div>
                      <p className="mt-0.5 text-caption text-muted-foreground tabular-nums">Up to {money(category.limit)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="tertiary" size="sm" onClick={() => onBeginEdit(category)} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="size-3.5" aria-hidden="true" /> Edit
                      </Button>
                      <IconButton
                        label={`Delete ${category.name}`}
                        onClick={() => { setEditingId(null); setDeleteError(null); setConfirmingDeleteId(category.id) }}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                )}
              </li>
            )
          })}

          <li className={cn('px-3 py-2.5 sm:px-4', isAdding && 'bg-primary/5')}>
            {isAdding ? (
              <div className="grid gap-3 py-1 sm:grid-cols-2">
                <CategoryFields
                  draft={newCategory}
                  errors={newCategoryErrors}
                  currency={currency}
                  autoFocus
                  onChange={(field, value) => {
                    setNewCategory(current => ({ ...current, [field]: value }))
                    setNewCategoryErrors(current => ({ ...current, [field]: undefined }))
                  }}
                />
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <Button variant="tertiary" size="sm" onClick={closeAdd} aria-label="Close add category form">Cancel</Button>
                  <Button size="sm" onClick={() => void onAddCategory()} loading={isAddingBusy}>Add</Button>
                </div>
              </div>
            ) : (
              <Button variant="tertiary" size="sm" onClick={() => setIsAdding(true)} className="-ml-2 text-accent-ink">
                <Plus className="size-4" aria-hidden="true" /> Add category
              </Button>
            )}
          </li>
        </ul>
      </div>
    </BottomSheet>
  )
}
