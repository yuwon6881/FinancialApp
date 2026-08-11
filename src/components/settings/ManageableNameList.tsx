import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { CollapsibleBody } from '../ui/CollapsibleBody'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export interface ManageableNameItem {
  id: string
  name: string
  count?: number | null
}

interface ManageableNameListProps<T extends ManageableNameItem> {
  items: T[]
  duplicateItems?: T[]
  itemLabel: string
  addPlaceholder: string
  addFormTitle?: string
  addFormDescription?: string
  addFormFields?: ReactNode
  /**
   * An extra control for the toolbar row, sitting between search and Add. Consumers own their own
   * filtering; this exists so a filter does not have to be stacked as a separate labelled row
   * above the list, which is what made three unrelated control clusters out of one toolbar.
   */
  filterSlot?: ReactNode
  disabled?: boolean
  isLoading?: boolean
  onAdd: (name: string) => Promise<void> | void
  onDelete: (item: T) => Promise<void> | void
  renderName?: (item: T) => ReactNode
  renderMeta?: (item: T) => ReactNode
  renderStatus?: (item: T) => ReactNode
  validateName?: (name: string) => string | null
}

export function ManageableNameList<T extends ManageableNameItem>({
  items,
  duplicateItems = items,
  itemLabel,
  addPlaceholder,
  addFormTitle,
  addFormDescription,
  addFormFields,
  filterSlot,
  disabled = false,
  isLoading = false,
  onAdd,
  onDelete,
  renderName,
  renderMeta,
  renderStatus,
  validateName,
}: ManageableNameListProps<T>) {
  const [newName, setNewName] = useState('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  // Adding is occasional; searching and scanning the list is what this panel is opened for. The
  // add form was permanently expanded above the search box, so the first thing on screen was a
  // form for something the user was usually not doing, and the three controls read as three
  // unrelated blocks rather than one toolbar over one list.
  const [isAddOpen, setIsAddOpen] = useState(false)
  const addInputId = useId()
  const addPanelId = useId()
  const lowerItemLabel = itemLabel.toLowerCase()
  const pluralItemLabel = /[^aeiou]y$/i.test(lowerItemLabel)
    ? `${lowerItemLabel.slice(0, -1)}ies`
    : `${lowerItemLabel}s`
  const trimmedName = newName.trim()
  const duplicate = duplicateItems.some(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase())
  const validationError = trimmedName && !duplicate ? validateName?.(trimmedName) ?? null : null
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? items.filter(item => item.name.toLowerCase().includes(query)) : items
  }, [items, search])

  const add = async () => {
    if (!trimmedName || duplicate || validationError || disabled || busyId) return
    setBusyId('new')
    try {
      await onAdd(trimmedName)
      setNewName('')
    } finally {
      setBusyId(null)
    }
  }

  // Leaving the panel discards the half-typed name, so the way out and the way in are the same
  // control rather than a second one appearing beside it.
  const toggleAdd = () => {
    setIsAddOpen(open => {
      if (open) setNewName('')
      return !open
    })
  }

  return (
    <div className="space-y-3">
      {/* One toolbar row: find, narrow, add. The search field may shrink on a phone, but the
          actions stay together so Add never becomes a detached second-line control. */}
      <div className="flex flex-nowrap items-center gap-2">
        <label className="group relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
          <Input
            type="text"
            role="searchbox"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={`Search ${pluralItemLabel}`}
            aria-label={`Search ${pluralItemLabel}`}
            className="h-9 w-full rounded-lg border border-border/70 bg-background py-2 pl-9 pr-9 text-xs transition placeholder:text-muted-foreground hover:border-border focus:border-ring/70 focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
          {search && (
            <Button variant="unstyled"
              type="button"
              onClick={() => setSearch('')}
              aria-label={`Clear ${lowerItemLabel} search`}
                  className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground sm:right-1 sm:size-8"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </label>

        {filterSlot}

        <Button
          variant={isAddOpen ? 'outline' : 'primary'}
          size="sm"
          type="button"
          onClick={toggleAdd}
          disabled={disabled}
          aria-expanded={isAddOpen}
          aria-controls={addPanelId}
          className="h-9 shrink-0 whitespace-nowrap px-2 sm:px-2.5"
        >
          {isAddOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {isAddOpen ? 'Cancel' : 'Add'}
        </Button>
      </div>

      <div id={addPanelId}>
        <CollapsibleBody open={isAddOpen}>
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
            {addFormTitle && (
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">{addFormTitle}</p>
                {addFormDescription && <p className="text-[11px] leading-relaxed text-muted-foreground">{addFormDescription}</p>}
              </div>
            )}
            {addFormFields}
            <div className="space-y-1.5">
              {addFormTitle && <label htmlFor={addInputId} className="block text-xs font-bold text-muted-foreground">{itemLabel} name</label>}
              <div className="flex gap-2">
                <Input
                  id={addInputId}
                  type="text"
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') void add() }}
                  placeholder={addPlaceholder}
                  aria-label={`New ${lowerItemLabel} name`}
                  disabled={disabled}
                  maxLength={40}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                />
                <Button variant="unstyled"
                  type="button"
                  onClick={() => void add()}
                  disabled={!trimmedName || duplicate || Boolean(validationError) || disabled || busyId !== null}
                  aria-label={`Add ${itemLabel}`}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:size-9"
                >
                  {busyId === 'new' ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                </Button>
              </div>
            </div>
            {duplicate && <p className="text-[10px] font-semibold text-destructive">{itemLabel} already exists.</p>}
            {validationError && <p className="text-[10px] font-semibold text-destructive">{validationError}</p>}
          </div>
        </CollapsibleBody>
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1" aria-busy={isLoading}>
        {isLoading ? (
          <div role="status" className="flex min-h-24 items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-blue-500" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            {search ? `No ${pluralItemLabel} match your search.` : `No ${pluralItemLabel} yet.`}
          </p>
        ) : filtered.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              {renderName ? renderName(item) : <span className="truncate font-semibold">{item.name}</span>}
              {renderMeta?.(item)}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {renderStatus?.(item)}
              <Button variant="unstyled"
                type="button"
                disabled={disabled || busyId !== null}
                onClick={async () => {
                  setBusyId(item.id)
                  try {
                    await onDelete(item)
                  } finally {
                    setBusyId(null)
                  }
                }}
                aria-label={`Delete ${item.name}`}
                className="inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50 sm:size-8"
              >
                {busyId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
