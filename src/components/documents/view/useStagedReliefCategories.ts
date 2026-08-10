import { useCallback, useState } from 'react'
import type { VaultDocument } from '../../../types'
import type { BulkDocumentCategoryUpdate, BulkDocumentCategoryUpdateResult } from '../../../lib/api/documents'
import { getErrorMessage } from '../../../lib/errors'
import { buildMutationSuccessToast } from '../../../lib/mutationToast'

interface UseStagedReliefCategoriesOptions {
  documents: VaultDocument[]
  bulkUpdate: (updates: BulkDocumentCategoryUpdate[]) => Promise<BulkDocumentCategoryUpdateResult[]>
  /** Marks rows busy while their staged change is in flight, through the shared RowSyncStatus path. */
  setRowsSyncing: (ids: number[], isSyncing: boolean) => void
  showToast: (message: string, title: string, tone: 'success' | 'error') => void
  guardSensitive: () => boolean
}

/**
 * The Vault's staged relief-category edits: a category change is collected rather than written, then
 * saved for every staged row in one request.
 *
 * Staging is not the same as a queued mutation, and the difference is the source of every rule here —
 * nothing is queued, so nothing replays and nothing is projected. The staged set must therefore be
 * dropped whenever its rows stop being the rows on screen (a filter change) or stop existing at all
 * (a delete); left behind, the "N staged" bar counted documents the user could neither see nor clear,
 * and a staged entry for a deleted row was re-sent on every Save, came back `updated: false`, and
 * pinned the bar on "N remain staged" forever.
 */
export function useStagedReliefCategories({
  documents,
  bulkUpdate,
  setRowsSyncing,
  showToast,
  guardSensitive,
}: UseStagedReliefCategoriesOptions) {
  const [staged, setStaged] = useState<Map<number, string>>(new Map())
  const [isSaving, setIsSaving] = useState(false)

  const stage = (id: number, reliefCategory: string) => {
    if (!guardSensitive()) return
    const document = documents.find(item => item.id === id)
    if (!document) return
    // Choosing the value the row already has is not a change, so it clears the staging instead of
    // recording a no-op that Save would then report as an update.
    const originalCategory = document.reliefCategory ?? ''
    setStaged(current => {
      const next = new Map(current)
      if (reliefCategory === originalCategory) next.delete(id)
      else next.set(id, reliefCategory)
      return next
    })
  }

  const clear = useCallback(() => setStaged(new Map()), [])

  /** Drops staged edits for rows that no longer exist, so the bar cannot outlive its documents. */
  const forget = useCallback((ids: number[]) => {
    setStaged(current => {
      if (!ids.some(id => current.has(id))) return current
      const next = new Map(current)
      ids.forEach(id => next.delete(id))
      return next
    })
  }, [])

  const save = async () => {
    if (!guardSensitive()) return
    if (staged.size === 0 || isSaving) return
    const entries = Array.from(staged.entries())
    const stagedIds = entries.map(([id]) => id)
    setIsSaving(true)
    setRowsSyncing(stagedIds, true)
    try {
      const results = await bulkUpdate(entries.map(([id, reliefCategory]) => ({ id, reliefCategory })))
      const resultsById = new Map(results.map(result => [result.id, result]))
      const failed = entries.filter(([id]) => resultsById.get(id)?.updated !== true)
      setStaged(current => {
        const next = new Map(current)
        for (const [id, stagedCategory] of entries) {
          // Only clear what is still staged as *this* value: the user may have changed it again
          // while the request was in flight, and that newer choice must survive.
          if (current.get(id) !== stagedCategory) continue
          if (resultsById.get(id)?.updated === true) next.delete(id)
          else next.set(id, stagedCategory)
        }
        return next
      })
      const savedCount = entries.length - failed.length
      if (failed.length) {
        // Each failed row carries its own reason from the server; without one of them on screen the
        // user is told to retry with no idea what to change first.
        const reason = failed.map(([id]) => resultsById.get(id)?.message).find(Boolean)
        showToast(
          `${savedCount} document categor${savedCount === 1 ? 'y' : 'ies'} updated; ${failed.length} remain staged.${reason ? ` ${reason}` : ''}`,
          'Document Categories Partially Updated',
          'error',
        )
      } else {
        const copy = buildMutationSuccessToast({
          entity: 'Document Categories',
          action: 'Updated',
          message: `${savedCount} document categor${savedCount === 1 ? 'y' : 'ies'} were updated together.`,
        })
        showToast(copy.message, copy.title, copy.tone)
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'The document categories could not be saved.'), 'Category update failed', 'error')
    } finally {
      setRowsSyncing(stagedIds, false)
      setIsSaving(false)
    }
  }

  return { staged, isSaving, stage, clear, forget, save }
}
