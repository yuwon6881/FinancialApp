import { AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { VaultDocumentTypeDefinition, VaultTypeCleanupSuggestion } from '../../types'
import * as api from '../../lib/api/documents'
import { getErrorMessage } from '../../lib/errors'
import { useAppUi } from '../../contexts/AppContext'
import { CustomSelect } from '../ui/CustomSelect'
import { ManageableNameList } from './ManageableNameList'

export function VaultDocumentTypesPanel() {
  const { showToast } = useAppUi()
  const [types, setTypes] = useState<VaultDocumentTypeDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<VaultDocumentTypeDefinition | null>(null)
  const [replacementId, setReplacementId] = useState('')
  const [suggestions, setSuggestions] = useState<VaultTypeCleanupSuggestion[]>([])
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [applyId, setApplyId] = useState<string | null>(null)
  const [targets, setTargets] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setTypes(await api.listDocumentTypes())
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load document types.'), 'Document Types', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => { void load() }, [load])

  const review = async () => {
    setIsReviewing(true)
    setReviewError(null)
    try {
      const result = await api.reviewDocumentTypeCleanup()
      setSuggestions(result.suggestions)
      if (result.suggestions.length === 0) {
        showToast('AI did not find document type cleanup changes worth proposing.', 'AI Review Complete', 'info')
      }
    } catch (error) {
      setReviewError(getErrorMessage(error, 'Could not review document types.'))
    } finally {
      setIsReviewing(false)
    }
  }

  const apply = async (suggestion: VaultTypeCleanupSuggestion) => {
    const target = targets[suggestion.id] || suggestion.targetCategory || undefined
    if (suggestion.type === 'consolidate' && !target) return
    setApplyId(suggestion.id)
    try {
      await api.applyDocumentTypeCleanup(suggestion, target)
      setSuggestions(current => current.filter(item => item.id !== suggestion.id))
      await load()
      showToast('Document type cleanup applied.', 'Document Types', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not apply this suggestion.'), 'Document Types', 'error')
    } finally {
      setApplyId(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Vault Document Types</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Customize the types available when uploading documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void review()}
          disabled={isReviewing || types.length === 0}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-45 dark:text-blue-400"
        >
          {isReviewing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          AI
        </button>
      </div>

      {(isReviewing || reviewError || suggestions.length > 0) && (
        <div className="mb-4 space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Sparkles className="size-3.5 text-accent-ink" /> AI Document Type Review
          </div>
          {isReviewing && <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin" />Reviewing usage…</p>}
          {reviewError && <p className="flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="size-3" />{reviewError}</p>}
          {!isReviewing && !reviewError && suggestions.length === 0 && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><CheckCircle2 className="size-3 text-emerald-500" />No cleanup proposals.</p>
          )}
          {suggestions.map(suggestion => {
            const options = types
              .filter(type => !suggestion.categories.some(name => name.toLowerCase() === type.name.toLowerCase()))
              .map(type => ({ value: type.name, label: type.name }))
            const target = targets[suggestion.id] || suggestion.targetCategory || ''
            return (
              <div key={suggestion.id} className="space-y-2 rounded-lg border border-border/60 bg-background p-2.5">
                <div>
                  <p className="text-xs font-bold">{suggestion.title}</p>
                  <p className="text-[11px] text-muted-foreground">{suggestion.summary}</p>
                </div>
                {suggestion.type === 'consolidate' && (
                  <CustomSelect
                    value={target}
                    onChange={value => setTargets(current => ({ ...current, [suggestion.id]: String(value) }))}
                    options={[{ value: '', label: 'Choose a document type' }, ...options]}
                    ariaLabel="Document type consolidation target"
                    className="w-full"
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {suggestion.affectedTransactionCount} saved document{suggestion.affectedTransactionCount === 1 ? '' : 's'} affected
                  </span>
                  <button
                    type="button"
                    onClick={() => void apply(suggestion)}
                    disabled={applyId !== null || suggestion.type === 'consolidate' && !target}
                    className="inline-flex h-8 w-20 cursor-pointer items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/5 text-[10px] font-bold text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
                  >
                    {applyId === suggestion.id ? <Loader2 className="size-3 animate-spin" /> : 'Accept'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ManageableNameList
        items={types}
        itemLabel="Document type"
        addPlaceholder="New Document Type"
        isLoading={isLoading}
        onAdd={async name => {
          await api.addDocumentType(name)
          await load()
        }}
        onDelete={async item => {
          if (item.usageCount > 0) {
            setDeleteTarget(item)
            setReplacementId('')
            return
          }
          await api.deleteDocumentType(item.id)
          await load()
        }}
        renderMeta={item => (
          <span className="text-[10px] text-muted-foreground">{item.usageCount} document{item.usageCount === 1 ? '' : 's'}</span>
        )}
      />

      {deleteTarget && (
        <div className="mt-4 space-y-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
          <p className="text-[11px] text-foreground">
            <strong>{deleteTarget.name}</strong> is used by {deleteTarget.usageCount} document{deleteTarget.usageCount === 1 ? '' : 's'}.
            Choose a replacement before deleting it.
          </p>
          <CustomSelect
            value={replacementId}
            onChange={value => setReplacementId(String(value))}
            options={[
              { value: '', label: 'Choose a replacement' },
              ...types.filter(type => type.id !== deleteTarget.id).map(type => ({ value: type.id, label: type.name })),
            ]}
            ariaLabel="Replacement document type"
            className="w-full"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
            <button
              type="button"
              disabled={!replacementId}
              onClick={async () => {
                await api.deleteDocumentType(deleteTarget.id, replacementId)
                setDeleteTarget(null)
                await load()
              }}
              className="cursor-pointer rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-50"
            >
              Replace & Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
