import React from 'react'
import { Plus, Check, X, Pencil, Trash2, Save } from 'lucide-react'
import type { TaxReliefCategoryDefinition } from '../../../types'
import { BottomSheet } from '../../ui/BottomSheet'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { RowSyncStatus } from '../../ui/RowSyncBadge'

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
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage tax relief limits for YA ${selectedYear}`}
      maxWidthClassName="max-w-2xl"
    >
      <div className="space-y-3" ref={sheetBodyRef}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-black">Categories and limits for YA {selectedYear}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">Only this year changes. Amounts marked for review are never counted as confirmed.</p>
          </div>
          {!isAdding && (
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsAdding(true)} className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Plus className="size-3.5" /> Add category
            </Button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {categories.map(category => {
            const isEditing = editingId === category.id
            const isDraftChanged = isEditing && (
              draft.name.trim() !== category.name ||
              (draft.limit.trim() !== '' && !Number.isNaN(Number(draft.limit)) && Number(draft.limit) !== category.limit)
            )

            return (
              <div
                key={category.id}
                className={`rounded-lg border p-2.5 transition-all duration-150 ${
                  isDraftChanged
                    ? 'border-blue-500/40 bg-blue-500/5 ring-2 ring-blue-500/50'
                    : 'border-border/60'
                }`}
              >
                {isEditing ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FormField label="Category" required error={draftErrors.name}><Input value={draft.name} onChange={event => { setDraft(current => ({ ...current, name: event.target.value })); setDraftErrors(current => ({ ...current, name: undefined })) }} controlSize="sm" /></FormField>
                    <FormField label={`Limit (${currency})`} required error={draftErrors.limit}><Input type="number" min="0" step="0.01" value={draft.limit} onChange={event => { setDraft(current => ({ ...current, limit: event.target.value })); setDraftErrors(current => ({ ...current, limit: undefined })) }} controlSize="sm" className="tabular-nums" /></FormField>
                    {draftErrors.form && <p role="alert" className="text-xs font-semibold text-destructive sm:col-span-2">{draftErrors.form}</p>}
                    <div className="flex items-center justify-end gap-1.5 sm:col-span-2">
                      {isDraftChanged && (
                        <span className="mr-auto flex items-center gap-1 text-xs font-semibold text-blue-500">
                          <span className="inline-block size-1.5 rounded-full bg-blue-500" title="Unsaved change" />
                          Unsaved changes
                        </span>
                      )}
                      <Button variant="primary" size="sm" type="button" onClick={() => void onSaveEdit(category.id)} disabled={savingId === category.id} className="py-2"><Save className="size-3.5" /> Save</Button>
                      <Button variant="tertiary" type="button" onClick={() => setEditingId(null)} aria-label="Close category editor" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></Button>
                    </div>
                  </div>
                ) : confirmingDeleteId === category.id ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                        Delete <span className="font-bold text-foreground">{category.name}</span> from YA {selectedYear}? Documents already filed under it must be moved first.
                      </p>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="destructive"
                          size="sm"
                          type="button"
                          onClick={() => void onDeleteCategory(category)}
                          disabled={deletingId === category.id || Boolean(deleteBlockedById.get(category.id))}
                          title={deleteBlockedById.get(category.id) ?? undefined}
                        >
                          <Trash2 className="size-3" /> Delete
                        </Button>
                        <Button variant="secondary" size="sm" type="button" onClick={() => { setConfirmingDeleteId(null); setDeleteError(null) }} className="text-muted-foreground hover:bg-muted hover:text-foreground">Cancel</Button>
                      </div>
                    </div>
                    {(deleteError?.id === category.id ? deleteError.message : deleteBlockedById.get(category.id)) && (
                      <p role="alert" className="text-xs font-semibold text-destructive">
                        {deleteError?.id === category.id ? deleteError.message : deleteBlockedById.get(category.id)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-xs font-bold">{category.name}</p>
                        <RowSyncStatus
                          entityLabel="tax relief category"
                          isDeleting={isCategoryDeleting(category.id)}
                          isSyncing={isCategorySyncing(category.id)}
                          isPending={category.isPendingSync && !isCategorySyncing(category.id)}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{money(category.limit)} limit{category.isInherited ? ' · inherited default' : ''}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button variant="secondary" size="sm" type="button" onClick={() => onBeginEdit(category)} className="text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-3" /> Edit</Button>
                      <Button variant="tertiary" type="button" onClick={() => { setEditingId(null); setDeleteError(null); setConfirmingDeleteId(category.id) }} aria-label={`Delete ${category.name}`} title={`Delete ${category.name}`} className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {isAdding && (
          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
            <div className="grid gap-2 sm:grid-cols-2">
              <FormField label="Category" required error={newCategoryErrors.name}><Input autoFocus value={newCategory.name} onChange={event => { setNewCategory(current => ({ ...current, name: event.target.value })); setNewCategoryErrors(current => ({ ...current, name: undefined })) }} placeholder="e.g. Education" controlSize="sm" /></FormField>
              <FormField label={`Limit (${currency})`} required error={newCategoryErrors.limit}><Input type="number" min="0" step="0.01" value={newCategory.limit} onChange={event => { setNewCategory(current => ({ ...current, limit: event.target.value })); setNewCategoryErrors(current => ({ ...current, limit: undefined })) }} controlSize="sm" className="tabular-nums" /></FormField>
              {newCategoryErrors.form && <p role="alert" className="text-xs font-semibold text-destructive sm:col-span-2">{newCategoryErrors.form}</p>}
              <div className="flex justify-end gap-1.5 sm:col-span-2"><Button variant="primary" size="sm" type="button" onClick={() => void onAddCategory()} disabled={isAddingBusy} className="py-2"><Check className="size-3.5" /> Add</Button><Button variant="tertiary" type="button" onClick={() => { setIsAdding(false); setNewCategory(EMPTY_CATEGORY_DRAFT); setNewCategoryErrors({}) }} aria-label="Close add category form" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></Button></div>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
