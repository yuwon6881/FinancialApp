import { useState, type CSSProperties } from 'react'
import { Lock, Plus, Trash2, Unlock } from 'lucide-react'
import type { InvestmentGroup } from '../../types'
import { changeGroupTarget, groupTargetLimit, groupTargetStep, investmentGroupColor, MAX_INVESTMENT_GROUPS, removeInvestmentGroup } from '../../lib/investmentGroups'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { IconButton } from '../ui/IconButton'
import { Input } from '../ui/Input'
import { RangeInput } from '../ui/RangeInput'
import { SegmentedMeter } from '../ui/SegmentedMeter'

const forecastOptions = [
  { value: '', label: 'No forecast assumption' },
  { value: 'USEquity', label: 'US shares' },
  { value: 'InternationalExUS', label: 'Shares outside the US' },
  { value: 'Bonds', label: 'Bonds' },
] as const

export function InvestmentGroupTargets({ groups, assignedKeys, disabled, onChange }: {
  groups: InvestmentGroup[]
  assignedKeys: ReadonlySet<string>
  disabled: boolean
  onChange: (groups: InvestmentGroup[]) => void
}) {
  const [locked, setLocked] = useState(true)
  const [lockedKey, setLockedKey] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const currentLock = groups.some(group => group.key === lockedKey) ? lockedKey : null
  const editable = !disabled && !locked
  const label = name.trim()
  const duplicateName = groups.some(group => group.label.toLowerCase() === label.toLowerCase())
  const atCapacity = groups.length >= MAX_INVESTMENT_GROUPS
  const total = Math.round(groups.reduce((sum, group) => sum + group.targetPercentage, 0) * 100) / 100

  const addGroup = () => {
    if (!editable || !label || duplicateName || atCapacity) return
    const added: InvestmentGroup = {
      key: crypto.randomUUID().replaceAll('-', ''), label, targetPercentage: 0, forecastClass: null,
    }
    onChange(changeGroupTarget([...groups, added], added.key, 5))
    setLockedKey(null)
    setName('')
    setAdding(false)
  }

  return (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="investment-targets-title" className="text-section text-foreground">Portfolio targets</h3>
          <p className="mt-1 text-caption text-muted-foreground">The share of your Growth investments each group should hold.</p>
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={() => setLocked(!locked)}
          disabled={disabled} aria-pressed={locked} className="shrink-0">
          {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          {locked ? 'Locked' : 'Unlocked'}
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        <SegmentedMeter size="md" total={100}
          label={`Target mix: ${groups.map(group => `${group.label} ${group.targetPercentage}%`).join(', ')}`}
          segments={groups.map((group, index) => ({ label: group.label, value: group.targetPercentage, color: investmentGroupColor(index) }))}
        />
        <p className="text-right text-caption tabular-nums text-muted-foreground">Total: {total}%</p>
      </div>

      <div className="mt-2 divide-y divide-border/60">
        {groups.map((group, index) => {
          const color = investmentGroupColor(index)
          const isLocked = currentLock === group.key
          const assigned = assignedKeys.has(group.key)
          const canRemove = groups.length > 1 && !assigned
          const hasCustomKey = !forecastOptions.some(option => option.value === group.key)
          return (
            <div key={group.key} className="w-full min-w-0 space-y-2 py-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="min-w-0 wrap-break-word text-label text-foreground">{group.label}</span>
                  {groups.length >= 3 && (
                    <IconButton type="button" label={`${isLocked ? 'Unlock' : 'Lock'} ${group.label} target`}
                      onClick={() => setLockedKey(isLocked ? null : group.key)}
                      className="-my-2 shrink-0 text-muted-foreground hover:text-foreground"
                      disabled={disabled || (currentLock !== null && !isLocked)}
                      tooltip={isLocked ? 'Unlock target' : currentLock ? 'Unlock the current target before locking another' : 'Lock target'}>
                      {isLocked ? <Lock className="size-3.5 text-accent-ink" /> : <Unlock className="size-3.5" />}
                    </IconButton>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-subsection text-foreground tabular-nums">{group.targetPercentage}%</span>
                  {editable && (
                    <IconButton type="button" label={`Remove ${group.label} group`} disabled={!canRemove}
                      tooltip={assigned ? 'Move the investments in this group first' : canRemove ? 'Remove group' : 'Keep at least one group'}
                      onClick={() => {
                        onChange(removeInvestmentGroup(groups, group.key))
                        setLockedKey(null)
                      }} className="-my-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>
              </div>
              <RangeInput aria-label={`${group.label} target`} min={groupTargetStep(groups)}
                max={isLocked ? 100 : groupTargetLimit(groups, currentLock)} step={groupTargetStep(groups)}
                disabled={!editable || isLocked || groups.length - Number(Boolean(currentLock)) < 2}
                value={group.targetPercentage} onChange={event => onChange(changeGroupTarget(groups, group.key, Number(event.target.value), currentLock))}
                style={{ '--range-color': color } as CSSProperties} />
              {hasCustomKey && (
                <CustomSelect ariaLabel={`Forecast assumption for ${group.label}`} disabled={!editable}
                  value={group.forecastClass ?? ''} options={[...forecastOptions]}
                  onChange={value => onChange(groups.map(item => item.key === group.key ? { ...item, forecastClass: value || null } : item))} />
              )}
            </div>
          )
        })}
      </div>

      {editable && (
        <div className="mt-2 space-y-2">
          {groups.length > 1 && <p className="text-caption text-muted-foreground">Move any assigned investments to another group before removing their group.</p>}
          {adding ? (
            <form noValidate className="space-y-2" onSubmit={event => { event.preventDefault(); addGroup() }}>
              <Input aria-label="Group name" placeholder="Group name" value={name} maxLength={60} onChange={event => setName(event.target.value)} />
              {duplicateName && <p role="status" className="text-caption text-destructive">A group already uses this name.</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="tertiary" onClick={() => { setAdding(false); setName('') }}>Cancel</Button>
                <Button type="submit" variant="secondary" disabled={!label || duplicateName}>Add group</Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setAdding(true)} disabled={atCapacity}>
                <Plus className="size-4" /> Add group
              </Button>
            </div>
          )}
          {groups.some(group => group.forecastClass === null) && (
            <p className="text-caption text-muted-foreground">Choose a forecast assumption for each group to see a long-term forecast.</p>
          )}
        </div>
      )}
    </>
  )
}
