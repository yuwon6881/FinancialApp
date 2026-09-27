import { useMemo, useState } from 'react'
import type { CaptureApplication } from '../../../lib/native/purchaseCapture'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Checkbox } from '../../ui/Checkbox'
import { FormField } from '../../ui/FormField'
import { Input } from '../../ui/Input'
import { ModalActions } from '../../ui/ModalActions'
import { Skeleton } from '../../ui/Skeleton'

interface Props {
  isOpen: boolean
  onClose: () => void
  applications: CaptureApplication[]
  loading: boolean
  busy: boolean
  /** The saved selection when the sheet opened; it stays pinned to the top while the user edits. */
  initial: string[]
  onSave: (packages: string[]) => Promise<boolean>
}

export function SourceAppsSheet({ isOpen, onClose, applications, loading, busy, initial, onSave }: Props) {
  const [selected, setSelected] = useState<string[]>(initial)
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const visible = useMemo(() => {
    const pinned = new Set(initial)
    return applications
      .filter(app => `${app.label} ${app.packageName}`.toLowerCase().includes(query))
      .sort((a, b) => Number(pinned.has(b.packageName)) - Number(pinned.has(a.packageName)))
  }, [applications, initial, query])
  const toggle = (name: string, checked: boolean) =>
    setSelected(previous => checked ? [...previous, name] : previous.filter(value => value !== name))

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Choose notification sources"
      description="Only alerts from the apps you tick are read. Choose your banking and e-wallet apps."
      footer={
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={loading} onClick={async () => { if (await onSave(selected)) onClose() }}>
            Save selection
          </Button>
        </ModalActions>
      }
    >
      <div className="space-y-3">
        <FormField label="Search apps">
          <Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Bank or wallet name" />
        </FormField>
        <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-9">
          <p className="text-xs text-muted-foreground" role="status">
            {selected.length === 0 ? 'No apps selected' : `${selected.length} ${selected.length === 1 ? 'app' : 'apps'} selected`}
          </p>
          {selected.length > 0 && <Button variant="tertiary" size="sm" onClick={() => setSelected([])}>Clear</Button>}
        </div>
        {loading ? (
          <div className="space-y-2" role="status" aria-label="Loading installed apps">
            {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-11 w-full rounded-control" />)}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-control bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            {query ? `No installed app matches “${search.trim()}”.` : 'No installed apps were found.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-control border border-border/60">
            {visible.map(app => (
              <li key={app.packageName}>
                <label className="flex min-h-13 cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-muted/40 sm:min-h-11">
                  <span className="min-w-0">
                    <span className="block break-words text-sm text-foreground">{app.label}</span>
                    <span className="block truncate text-xs text-muted-foreground" aria-hidden="true">{app.packageName}</span>
                  </span>
                  <Checkbox aria-label={app.label} checked={selected.includes(app.packageName)} onChange={event => toggle(app.packageName, event.target.checked)} />
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Selecting an app doesn’t guarantee its alerts can be read — recognition depends on how the app words them.</p>
      </div>
    </BottomSheet>
  )
}
