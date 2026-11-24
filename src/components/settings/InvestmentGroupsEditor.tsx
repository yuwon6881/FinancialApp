import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { InvestmentForecastClass, InvestmentGroup } from '../../types'
import { changeGroupTarget, MAX_INVESTMENT_GROUPS, removeInvestmentGroup } from '../../lib/investmentGroups'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'

const forecastOptions: Array<{ value: InvestmentForecastClass | ''; label: string }> = [
  { value: '', label: 'No forecast assumption' },
  { value: 'USEquity', label: 'US shares' },
  { value: 'InternationalExUS', label: 'Shares outside the US' },
  { value: 'Bonds', label: 'Bonds' },
]

export function InvestmentGroupsEditor({ groups, assignedKeys, disabled, onChange }: {
  groups: InvestmentGroup[]
  assignedKeys: ReadonlySet<string>
  disabled: boolean
  onChange: (groups: InvestmentGroup[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const label = name.trim()
  const duplicateName = groups.some(group => group.label.toLowerCase() === label.toLowerCase())
  const atCapacity = groups.length >= MAX_INVESTMENT_GROUPS
  const close = () => { setAdding(false); setName('') }

  const addGroup = () => {
    if (disabled || !label || duplicateName || atCapacity) return
    const added: InvestmentGroup = {
      key: crypto.randomUUID().replaceAll('-', ''), label, targetPercentage: 0, forecastClass: null,
    }
    onChange(changeGroupTarget([...groups, added], added.key, 5))
    close()
  }

  return (
    <section aria-labelledby="investment-groups-title" className="mt-4 border-t border-border pt-4">
      <h4 id="investment-groups-title" className="text-subsection text-foreground">Investment groups</h4>
      <p className="mt-1 text-caption text-muted-foreground">
        {groups.length ? 'Unassign or move investments before removing their group.' : 'Add a group to classify investments, or leave this list empty.'}
      </p>
      {groups.length > 0 && <ul className="mt-2 divide-y divide-border/60">
        {groups.map(group => (
          <li key={group.key} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 wrap-anywhere text-label text-foreground">{group.label}</span>
            <CustomSelect ariaLabel={`Forecast assumption for ${group.label}`} disabled={disabled}
              value={group.forecastClass ?? ''} options={forecastOptions}
              onChange={value => onChange(groups.map(item => item.key === group.key ? { ...item, forecastClass: value || null } : item))} />
            <IconButton label={`Remove ${group.label} group`} disabled={disabled || assignedKeys.has(group.key)}
              tooltip={assignedKeys.has(group.key) ? 'Unassign or move the investments in this group first' : 'Remove group'}
              onClick={() => onChange(removeInvestmentGroup(groups, group.key))} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>}
      {adding ? (
        <form noValidate className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); addGroup() }}>
          <Input aria-label="Group name" placeholder="Group name" value={name} maxLength={60} disabled={disabled} onChange={event => setName(event.target.value)} />
          {duplicateName && <p role="status" className="text-caption text-destructive">A group already uses this name.</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="tertiary" onClick={close}>Cancel</Button>
            <Button type="submit" variant="secondary" disabled={disabled || !label || duplicateName || atCapacity}>Add group</Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={() => setAdding(true)} disabled={disabled || atCapacity}>
            <Plus className="size-4" aria-hidden="true" /> Add group
          </Button>
        </div>
      )}
    </section>
  )
}
