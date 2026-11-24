import { useState } from 'react'
import { Info, Plus, Trash2 } from 'lucide-react'
import type { InvestmentAllocationOverview, InvestmentForecastClass, InvestmentGroup } from '../../types'
import { addInvestmentGroup, investmentGroupColor, MAX_INVESTMENT_GROUPS, releasedByRemoval, removeInvestmentGroup } from '../../lib/investmentGroups'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { PillSwitch } from '../ui/PillSwitch'
import { panelClass } from '../ui/panelStyles'

const forecastOptions: Array<{ value: InvestmentForecastClass | ''; label: string }> = [
  { value: '', label: 'No forecast assumption' },
  { value: 'USEquity', label: 'US shares' },
  { value: 'InternationalExUS', label: 'Shares outside the US' },
  { value: 'Bonds', label: 'Bonds' },
]

type Assignment = InvestmentAllocationOverview['assignments'][number]

export function InvestmentGroupsPanel({ enabled, onEnabledChange, groups, assignments, targetsActive, disabled, onChange }: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  groups: InvestmentGroup[]
  assignments: readonly Assignment[]
  targetsActive: boolean
  disabled: boolean
  onChange: (groups: InvestmentGroup[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const label = name.trim()
  const duplicateName = groups.some(group => group.label.toLowerCase() === label.toLowerCase())
  const atCapacity = groups.length >= MAX_INVESTMENT_GROUPS
  const counts = new Map<string, number>()
  for (const assignment of assignments) {
    if (assignment.sleeve) counts.set(assignment.sleeve, (counts.get(assignment.sleeve) ?? 0) + 1)
  }
  const released = releasedByRemoval(groups, assignments)
  const close = () => { setAdding(false); setName('') }

  const addGroup = () => {
    if (disabled || !label || duplicateName || atCapacity) return
    onChange(addInvestmentGroup(groups, label, targetsActive))
    close()
  }

  return (
    <section aria-labelledby="investment-groups-title" className={cn(panelClass, 'w-full min-w-0 p-4 sm:p-6')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="investment-groups-title" className="text-section text-foreground">Investment groups</h3>
          <p className="mt-1 text-caption text-muted-foreground">
            Sort your investments into groups you name, such as shares, bonds or property.
          </p>
        </div>
        <PillSwitch checked={enabled} onChange={onEnabledChange} disabled={disabled} ariaLabel="Group investments" />
      </div>

      {!enabled ? (
        <p className="mt-3 rounded-control inset-group p-3 text-caption text-muted-foreground">
          {counts.size > 0
            ? 'Off. Turning it back on restores your groups.'
            : 'Off. Turn it on to add your first group.'}
        </p>
      ) : (
        <>
          {groups.length === 0 ? (
            <p className="mt-3 rounded-control inset-group p-3 text-caption text-muted-foreground">
              No groups yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {groups.map((group, index) => {
                const count = counts.get(group.key) ?? 0
                return (
                  <li key={group.key} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="flex min-w-[8rem] flex-1 items-center gap-2">
                      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: investmentGroupColor(index) }} />
                      <span className="min-w-0">
                        <span className="block wrap-anywhere text-label text-foreground">{group.label}</span>
                        <span className="block text-caption text-muted-foreground">
                          {count === 0 ? 'No investments' : `${count} investment${count === 1 ? '' : 's'}`}
                        </span>
                      </span>
                    </span>
                    <CustomSelect ariaLabel={`Forecast assumption for ${group.label}`} disabled={disabled}
                      value={group.forecastClass ?? ''} options={forecastOptions}
                      onChange={value => onChange(groups.map(item => item.key === group.key ? { ...item, forecastClass: value || null } : item))} />
                    <IconButton label={`Remove ${group.label} group`} disabled={disabled} tooltip="Remove group"
                      onClick={() => onChange(removeInvestmentGroup(groups, group.key))}
                      className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          )}

          {released.length > 0 && (
            <p role="status" className="mt-2 flex gap-2 rounded-control inset-group p-3 text-caption text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Saving moves {released.map(item => item.symbol).join(', ')} to Not sorted. You can undo straight after saving.
              </span>
            </p>
          )}

          {adding ? (
            <form noValidate className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); addGroup() }}>
              <Input aria-label="Group name" placeholder="Group name" value={name} maxLength={60} disabled={disabled} autoFocus
                onChange={event => setName(event.target.value)} />
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
        </>
      )}
    </section>
  )
}
