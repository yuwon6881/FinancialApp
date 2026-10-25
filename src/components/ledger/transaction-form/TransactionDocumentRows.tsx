import { Eye, FileImage, FileText, Link2Off, Undo2, X } from 'lucide-react'
import type { VaultDocument } from '../../../types'
import { cn, formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../../../lib/utils'
import { formatBytes } from '../../documents/view/formatters'
import { CustomSelect, type SelectOption } from '../../ui/CustomSelect'
import { FormField } from '../../ui/FormField'
import { IconButton } from '../../ui/IconButton'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'

/**
 * The rows the transaction form lists its documents in. Kept apart from the field's state so a
 * filed document and a staged one share one shape: a tile, a name, one quiet line of facts, and
 * the row's actions on its trailing edge.
 */

const ROW_CLASS = 'flex min-w-0 items-center gap-3 px-3 py-2.5'
const TILE_CLASS = 'grid size-10 shrink-0 place-items-center overflow-hidden rounded-control bg-surface-2 text-muted-foreground dark:bg-surface-3'

function DocumentTile({ contentType, previewUrl }: { contentType: string; previewUrl?: string | null }) {
  if (previewUrl) {
    return (
      <span className={TILE_CLASS}>
        <img src={previewUrl} alt="" className="size-full object-cover" />
      </span>
    )
  }
  const Icon = contentType.startsWith('image/') ? FileImage : FileText
  return (
    <span className={TILE_CLASS}>
      <Icon className="size-4.5" aria-hidden="true" />
    </span>
  )
}

interface FiledDocumentRowProps {
  document: VaultDocument
  categoryName: string | undefined
  currency: string
  masked: boolean
  isDetaching: boolean
  disabled: boolean
  onPreview: () => void
  onDetach: () => void
  onUndoDetach: () => void
}

/** A document already filed against this transaction. Detaching is staged, and undoable, until save. */
export function FiledDocumentRow({
  document,
  categoryName,
  currency,
  masked,
  isDetaching,
  disabled,
  onPreview,
  onDetach,
  onUndoDetach,
}: FiledDocumentRowProps) {
  const facts = [
    categoryName ?? 'No relief category',
    document.amount != null ? (masked ? SENSITIVE_AMOUNT_MASK : formatCurrencyVal(document.amount, currency)) : null,
    `YA ${document.taxYear}`,
  ].filter(Boolean).join(' · ')
  return (
    <li className={ROW_CLASS} data-testid={`filed-document-${document.id}`}>
      <>
        <span className={cn('shrink-0', isDetaching && 'opacity-50')}><DocumentTile contentType={document.contentType} /></span>
        <div className={cn('min-w-0 flex-1', isDetaching && 'opacity-80')}>
          <p className={cn('truncate text-body font-medium text-foreground', isDetaching && 'line-through decoration-muted-foreground/60')} title={document.originalFileName}>
            {document.originalFileName}
          </p>
          <p className="truncate text-caption text-muted-foreground tabular-nums" title={facts}>
            {isDetaching ? 'Detaches when you save · stays in your Vault' : facts}
          </p>
        </div>
        {isDetaching ? (
          <Button variant="tertiary" size="sm" onClick={onUndoDetach} disabled={disabled} className="shrink-0">
            <Undo2 className="size-3.5" aria-hidden="true" />
            Undo
          </Button>
        ) : (
          <span className="flex shrink-0 items-center gap-0.5">
            <IconButton label={`Preview ${document.originalFileName}`} tooltip="Preview" onClick={onPreview} className="text-muted-foreground hover:text-foreground">
              <Eye className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label={`Detach ${document.originalFileName} from this transaction`}
              tooltip="Detach (stays in your Vault)"
              onClick={onDetach}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground"
            >
              <Link2Off className="size-4" aria-hidden="true" />
            </IconButton>
          </span>
        )}
      </>
    </li>
  )
}

interface StagedDocumentRowProps {
  file: File
  previewUrl: string | null
  reliefCategory: string
  categoryOptions: SelectOption<string>[]
  categoriesReady: boolean
  /** Only once a save has been tried: a file just picked has not done anything wrong yet. */
  showError: boolean
  onCategoryChange: (value: string) => void
  onRemove: () => void
}

/** A file picked in this form. It uploads with the transaction, filed under the category chosen here. */
export function StagedDocumentRow({
  file,
  previewUrl,
  reliefCategory,
  categoryOptions,
  categoriesReady,
  showError,
  onCategoryChange,
  onRemove,
}: StagedDocumentRowProps) {
  const invalid = showError && !reliefCategory
  return (
    <li className="space-y-2.5 px-3 py-2.5" data-testid="staged-document">
      <div className="flex min-w-0 items-center gap-3">
        <DocumentTile contentType={file.type} previewUrl={previewUrl} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-body font-medium text-foreground" title={file.name}>{file.name}</span>
            <Badge tone="accent" className="shrink-0">New</Badge>
          </p>
          <p className="truncate text-caption text-muted-foreground tabular-nums">
            {formatBytes(file.size)} · uploads when you save
          </p>
        </div>
        <IconButton label={`Remove ${file.name}`} tooltip="Remove" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive">
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
      <FormField
        label="Tax relief category"
        required
        error={invalid ? 'Choose where this document counts before saving.' : undefined}
      >
        <CustomSelect
          value={reliefCategory}
          ariaLabel={`Tax relief category for ${file.name}`}
          onChange={value => onCategoryChange(String(value))}
          options={categoryOptions}
          className="w-full"
          disabled={!categoriesReady}
          required
          invalid={invalid}
        />
      </FormField>
    </li>
  )
}
