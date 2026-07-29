import { Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export interface ManageableNameItem {
  id: string
  name: string
  count?: number | null
}

interface ManageableNameListProps<T extends ManageableNameItem> {
  items: T[]
  itemLabel: string
  addPlaceholder: string
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
  itemLabel,
  addPlaceholder,
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
  const trimmedName = newName.trim()
  const duplicate = items.some(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase())
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={event => setNewName(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void add() }}
          placeholder={addPlaceholder}
          disabled={disabled}
          maxLength={40}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!trimmedName || duplicate || Boolean(validationError) || disabled || busyId !== null}
          aria-label={`Add ${itemLabel}`}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {busyId === 'new' ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        </button>
      </div>
      {duplicate && <p className="text-[10px] font-semibold text-destructive">{itemLabel} already exists.</p>}
      {validationError && <p className="text-[10px] font-semibold text-destructive">{validationError}</p>}

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={`Search ${itemLabel.toLowerCase()}s`}
          aria-label={`Search ${itemLabel.toLowerCase()}s`}
          className="h-9 w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1" aria-busy={isLoading}>
        {isLoading ? (
          <div role="status" className="flex min-h-24 items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-blue-500" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            {search ? `No ${itemLabel.toLowerCase()}s match your search.` : `No ${itemLabel.toLowerCase()}s yet.`}
          </p>
        ) : filtered.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              {renderName ? renderName(item) : <span className="truncate font-semibold">{item.name}</span>}
              {renderMeta?.(item)}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {renderStatus?.(item)}
              <button
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
                className="cursor-pointer text-muted-foreground transition hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === item.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
