import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { VaultDocumentTypeDefinition, VaultTypeCleanupSuggestion } from '../../types'
import * as api from '../../lib/api/documents'
import { getErrorMessage } from '../../lib/errors'
import { useAppUi } from '../../contexts/AppContext'
import { CollapsibleBody } from '../ui/CollapsibleBody'
import { CustomSelect } from '../ui/CustomSelect'
import { PerimeterBeam } from '../ui/PerimeterBeam'
import { ManageableNameList } from './ManageableNameList'

export function VaultDocumentTypesPanel() {
  const { confirm, showToast } = useAppUi()
  const [types, setTypes] = useState<VaultDocumentTypeDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const [suggestions, setSuggestions] = useState<VaultTypeCleanupSuggestion[]>([])
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [applyId, setApplyId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [targets, setTargets] = useState<Record<string, string>>({})
  const replacementIdRef = useRef('')

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
    setIsOpen(true)
    setIsReviewOpen(true)
    setIsReviewing(true)
    setReviewError(null)
    try {
      const result = await api.reviewDocumentTypeCleanup()
      setSuggestions(result.suggestions)
      if (result.suggestions.length === 0) {
        showToast('AI did not find document type cleanup changes worth proposing.', 'AI Review Complete', 'info')
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Could not review document types.')
      setReviewError(message)
      showToast(message, 'AI Review Failed', 'error')
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

  const deleteType = async (item: VaultDocumentTypeDefinition, replacementId?: string) => {
    setDeletingId(item.id)
    try {
      await api.deleteDocumentType(item.id, replacementId)
      setTypes(current => current.filter(type => type.id !== item.id))
      showToast(
        `${item.name} was deleted.`,
        'Document Type Deleted',
        'success',
        replacementId
          ? undefined
          : {
              label: 'Undo',
              onAction: () => {
                void (async () => {
                  try {
                    const restored = await api.addDocumentType(item.name, item.id)
                    setTypes(current => [...current, restored].sort((a, b) => a.name.localeCompare(b.name)))
                    showToast(`${item.name} was restored.`, 'Undo successful', 'success')
                  } catch (error) {
                    showToast(getErrorMessage(error, 'Could not restore the document type.'), 'Undo failed', 'error')
                  }
                })()
              },
            },
      )
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not delete the document type.'), 'Delete Failed', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const requestDelete = (item: VaultDocumentTypeDefinition) => {
    replacementIdRef.current = ''
    const replacementOptions = types.filter(type => type.id !== item.id)
    const requiresReplacement = item.usageCount > 0

    const openConfirmation = () => {
      confirm({
        title: 'Delete Document Type',
        message: (
          <div className={`space-y-3 ${requiresReplacement ? 'pb-36' : ''}`}>
            <p>Delete "{item.name}"?</p>
            {requiresReplacement ? (
              <>
                <p>
                  This document type is used by {item.usageCount} saved document{item.usageCount === 1 ? '' : 's'}.
                  Choose a replacement document type before deleting it.
                </p>
                <CustomSelect
                  value={replacementIdRef.current}
                  onChange={value => {
                    replacementIdRef.current = String(value)
                    openConfirmation()
                  }}
                  options={[
                    { value: '', label: 'Choose replacement document type' },
                    ...replacementOptions.map(type => ({ value: type.id, label: type.name })),
                  ]}
                  ariaLabel="Replacement document type"
                  className="w-full"
                />
                {replacementOptions.length === 0 && (
                  <p className="text-[11px] font-semibold text-orange-500">
                    Add another document type before deleting this one.
                  </p>
                )}
              </>
            ) : (
              <p>No saved documents currently use this document type.</p>
            )}
          </div>
        ),
        confirmText: requiresReplacement ? 'Transfer and Delete' : 'Delete',
        confirmDisabled: requiresReplacement && replacementIdRef.current.length === 0,
        onConfirm: () => {
          void deleteType(item, replacementIdRef.current || undefined)
        },
      })
    }

    openConfirmation()
  }

  const unusedCount = types.filter(type => type.usageCount === 0).length

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs sm:p-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(current => !current)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setIsOpen(current => !current)
          }
        }}
        aria-expanded={isOpen}
        className={`flex cursor-pointer select-none items-center justify-between gap-3 ${isOpen ? 'border-b border-border/40 pb-3' : ''}`}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">Vault Document Types</h3>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            <div>{isLoading ? 'Loading document types…' : `${types.length} active document types.`}</div>
            {!isLoading && unusedCount > 0 && (
              <div className="mt-0.5 font-semibold text-orange-500">{unusedCount} unused</div>
            )}
            {!isLoading && types.length > 0 && unusedCount === 0 && (
              <div className="mt-0.5 font-semibold text-emerald-500">all types in use</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={event => { event.stopPropagation(); void review() }}
            disabled={isReviewing || types.length === 0}
            title="AI document type review"
            className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 transition dark:text-blue-400 ${
              isReviewing
                ? 'border-blue-500/35 bg-blue-500/5'
                : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-45'
            }`}
          >
            {isReviewing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            AI
          </button>
          {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </div>

      <CollapsibleBody open={isOpen}>
        <div className="space-y-4 px-0.5 pt-4">
          {(isReviewOpen || reviewError) && (
            <div className={`space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3 ${isReviewing ? 'perimeter-beam-host' : ''}`}>
              {isReviewing && <PerimeterBeam size={120} />}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Sparkles className="size-3.5 text-accent-ink" /> AI Document Type Review
                </div>
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="cursor-pointer rounded-md p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
                  aria-label="Close AI document type review"
                >
                  <ChevronUp className="size-3.5" />
                </button>
              </div>
              {isReviewing && <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground"><Loader2 className="size-3.5 animate-spin text-accent-ink" />Reviewing document type usage...</p>}
              {reviewError && <p className="flex items-center gap-1 text-[11px] font-semibold text-orange-500"><AlertCircle className="size-3" />{reviewError}</p>}
              {!isReviewing && !reviewError && suggestions.length === 0 && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-500" />No cleanup proposals right now.</p>
              )}
              {!isReviewing && suggestions.length > 0 && (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {suggestions.map(suggestion => {
                    const options = types
                      .filter(type => !suggestion.categories.some(name => name.toLowerCase() === type.name.toLowerCase()))
                      .map(type => ({ value: type.name, label: type.name }))
                    const target = targets[suggestion.id] || suggestion.targetCategory || ''
                    const confidence = Math.round(Math.max(0, Math.min(1, suggestion.confidence)) * 100)
                    return (
                      <div key={suggestion.id} className="space-y-2 rounded-lg border border-border/60 bg-background p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold">{suggestion.title}</p>
                            <p className="text-[11px] leading-relaxed text-muted-foreground">{suggestion.summary}</p>
                          </div>
                          <span className="shrink-0 rounded-md border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-600 dark:text-blue-400">
                            Confidence {confidence}%
                          </span>
                        </div>
                        {suggestion.type === 'consolidate' && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">Move its documents to:</span>
                            <CustomSelect
                              value={target}
                              onChange={value => setTargets(current => ({ ...current, [suggestion.id]: String(value) }))}
                              options={[{ value: '', label: 'Choose a document type' }, ...options]}
                              ariaLabel="Document type consolidation target"
                              className="w-full"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex h-8 min-w-0 items-center rounded-full border border-border bg-muted/30 px-2.5 text-[9px] font-bold uppercase text-muted-foreground">
                            {suggestion.affectedTransactionCount === 0
                              ? 'No saved documents affected'
                              : `${suggestion.affectedTransactionCount} saved document${suggestion.affectedTransactionCount === 1 ? '' : 's'} need validation`}
                          </span>
                          <button
                            type="button"
                            onClick={() => void apply(suggestion)}
                            disabled={applyId !== null || suggestion.type === 'consolidate' && !target}
                            className="inline-flex h-8 w-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/5 text-[10px] font-bold text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
                          >
                            {applyId === suggestion.id ? <Loader2 className="size-3 animate-spin" /> : 'Accept'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <ManageableNameList
            items={types}
            itemLabel="Document type"
            addPlaceholder="New Document Type"
            isLoading={isLoading}
            disabled={deletingId !== null}
            onAdd={async name => {
              const created = await api.addDocumentType(name)
              setTypes(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
              showToast(`${created.name} was added.`, 'Document Type Added', 'success')
            }}
            onDelete={requestDelete}
            renderMeta={item => (
              <span className={`truncate text-[10px] font-semibold ${item.usageCount === 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                {item.usageCount === 0 ? 'Unused' : `${item.usageCount} document${item.usageCount === 1 ? '' : 's'}`}
              </span>
            )}
            renderStatus={item => deletingId === item.id ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
          />
        </div>
      </CollapsibleBody>
    </div>
  )
}
