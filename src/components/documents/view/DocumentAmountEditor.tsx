import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Sparkles, X } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { getErrorMessage } from '../../../lib/errors'
import { useAppPrefs } from '../../../contexts/AppContext'
import { cn, formatCurrencyVal, getCurrencySymbol } from '../../../lib/utils'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { SensitiveMask } from '../../ui/SensitiveAmount'
import type { UpdateDocumentFn } from './documentRowParts'
import { confidenceLabel } from './formatters'

interface DocumentAmountEditorProps {
  document: VaultDocument
  updateDocument: UpdateDocumentFn
  currency?: string
  disabled?: boolean
  /** `stacked` puts the AI caption under the figure; `inline` is for a table cell. */
  layout?: 'stacked' | 'inline'
}

/**
 * A document's amount, and the one place it is confirmed or corrected.
 *
 * An amount the AI read is the common case, and it is usually right, so confirming it is one tap on
 * the row -- it used to take opening an editor and pressing its tick. Correcting it opens the editor
 * pre-filled and focused: Enter saves, Escape leaves without writing anything.
 */
export function DocumentAmountEditor({ document, updateDocument, currency, disabled = false, layout = 'stacked' }: DocumentAmountEditorProps) {
  const { currency: appCurrency, hideSensitive } = useAppPrefs()
  const activeCurrency = currency ?? appCurrency
  const [editing, setEditing] = useState(false)
  const needsReview = document.amountStatus === 'NeedsReview'
  const [value, setValue] = useState(document.amount?.toFixed(2) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => setValue(document.amount?.toFixed(2) ?? ''), [document.amount])
  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  // Leaving the editor must cost nothing: a mis-tap is never a write.
  const cancel = () => {
    setValue(document.amount?.toFixed(2) ?? '')
    setError(null)
    setEditing(false)
  }

  const write = async (amount: number) => {
    setError(null)
    setSaving(true)
    try {
      await updateDocument(document.id, {
        amount,
        amountCurrency: activeCurrency.toUpperCase() === 'MYR' ? 'MYR' : 'OTHER',
        amountStatus: 'Confirmed',
      })
      setEditing(false)
    } catch (error) {
      // The server refuses this write for reasons the user can act on, and names them; the editor
      // stays open with the typed value so it can be corrected rather than retyped.
      setError(getErrorMessage(error, 'That amount could not be saved. Please try again.'))
      setEditing(true)
    } finally { setSaving(false) }
  }

  const save = () => {
    if (disabled || saving) return
    const trimmed = value.trim()
    // An empty field is refused rather than saved as "definitively no amount": it is almost always
    // a cleared field on the way to typing a new figure.
    if (trimmed === '') {
      setError('Enter an amount, or press ✕ to leave this unchanged.')
      return
    }
    const amount = Number(trimmed)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter an amount of zero or more.')
      return
    }
    void write(amount)
  }

  if (hideSensitive) return <SensitiveMask />

  if (editing) {
    return (
      <div>
        <div
          className="flex items-center gap-1.5"
          onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); cancel() }
            if (event.key === 'Enter') { event.preventDefault(); save() }
          }}
        >
          <span className="text-caption font-semibold text-muted-foreground">{getCurrencySymbol(activeCurrency)}</span>
          <Input
            ref={inputRef}
            value={value}
            onChange={event => { setValue(event.target.value); setError(null) }}
            disabled={disabled || saving}
            inputMode="decimal"
            aria-label={`Amount for ${document.originalFileName}`}
            aria-invalid={error ? true : undefined}
            controlSize="sm"
            className="w-24 tabular-nums"
          />
          <IconButton
            variant="primary"
            onClick={save}
            disabled={disabled || saving}
            label={`Confirm amount for ${document.originalFileName}`}
            tooltip="Save (Enter)"
            className="shrink-0"
          >
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </IconButton>
          <IconButton
            onClick={cancel}
            disabled={saving}
            label={`Stop editing the amount for ${document.originalFileName}`}
            tooltip="Cancel (Esc)"
            className="shrink-0 text-muted-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        {error && <p className="mt-1 text-caption font-semibold text-destructive" role="alert">{error}</p>}
      </div>
    )
  }

  const formatted = document.amount != null ? formatCurrencyVal(document.amount, activeCurrency) : null
  const sure = needsReview ? confidenceLabel(document.amountConfidence) : null

  return (
    <div className={cn('min-w-0', layout === 'inline' ? 'flex items-center gap-1.5' : 'space-y-1')}>
      <div className="flex items-center gap-1">
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={disabled}
          aria-label={needsReview
            ? `Review the suggested amount for ${document.originalFileName}`
            : formatted ? `Edit amount ${formatted} for ${document.originalFileName}` : `Add amount for ${document.originalFileName}`}
          className={cn(
            'group -ml-2 shrink-0 gap-1.5 px-2 tabular-nums',
            needsReview ? 'text-amber-700 dark:text-amber-300' : formatted ? 'font-semibold text-foreground' : 'text-accent-ink',
          )}
        >
          {needsReview && <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />}
          <span className={cn(needsReview && 'font-semibold')}>{formatted ?? 'Add amount'}</span>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
        </Button>
        {needsReview && document.amount != null && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void write(document.amount!)}
            disabled={disabled || saving}
            loading={saving}
            aria-label={`Confirm ${formatted} for ${document.originalFileName}`}
            title="The amount is right"
            className="shrink-0 gap-1 px-2.5"
          >
            <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            Confirm
          </Button>
        )}
      </div>
      {needsReview && layout === 'stacked' && (
        <p className="text-caption text-muted-foreground">Read by AI{sure ? ` · ${sure}` : ''} · check it matches</p>
      )}
      {error && <p className="text-caption font-semibold text-destructive" role="alert">{error}</p>}
    </div>
  )
}
