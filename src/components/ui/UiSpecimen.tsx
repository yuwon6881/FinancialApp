import { Check, Download, Plus, Trash2 } from 'lucide-react'
import { Badge, StatusBadge } from './Badge'
import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { IconButton } from './IconButton'
import { Input } from './Input'
import { PageHeader } from './PageHeader'
import { Panel } from './Panel'
import { SectionHeader } from './SectionHeader'
import { Tabs } from './Tabs'
import { Toolbar } from './Toolbar'
import { InteractiveCard } from './InteractiveCard'

export function UiSpecimen() {
  return (
    <div className="space-y-5" aria-label="Ayu interface specimen">
      <PageHeader
        title="Ayu interface"
        description="Canonical actions, controls, status, and surfaces used throughout FinancialApp."
        icon={<span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-accent-ink"><Check className="size-5" /></span>}
        actions={<Button><Plus className="size-4" />Primary action</Button>}
      />

      <Panel className="space-y-6">
        <SectionHeader title="Actions" description="One hierarchy and one geometry at every breakpoint." />
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary"><Download className="size-4" />Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="destructive"><Trash2 className="size-4" />Destructive</Button>
          <Button loading loadingLabel="Saving">Save changes</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Add item"><Plus className="size-4" /></IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-3" aria-label="Button sizes">
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="md" variant="secondary">Medium</Button>
          <Button size="lg" variant="secondary">Large</Button>
          <IconButton label="Icon size" variant="secondary"><Plus className="size-4" /></IconButton>
        </div>

        <SectionHeader title="Status and navigation" />
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge><Badge tone="accent">Accent</Badge><Badge tone="info">Info</Badge>
          <StatusBadge tone="success">Ready</StatusBadge><StatusBadge tone="warning">Review</StatusBadge><StatusBadge tone="danger">Failed</StatusBadge>
        </div>
        <Tabs
          value="overview"
          onValueChange={() => undefined}
          options={[
            { value: 'overview', label: 'Overview', count: 4 },
            { value: 'activity', label: 'Activity', count: 12 },
            { value: 'settings', label: 'Settings' },
          ] as const}
          label="Specimen sections"
          idPrefix="specimen-tab"
          scrollable
        />
        <Tabs
          value="overview"
          onValueChange={() => undefined}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'activity', label: 'Activity' },
          ] as const}
          label="Segmented specimen sections"
          idPrefix="segmented-specimen-tab"
          variant="segmented"
        />

        <SectionHeader title="Controls and toolbars" />
        <Toolbar aria-label="Specimen toolbar">
          <Input aria-label="Search records" placeholder="Search records" className="min-w-48 flex-1" />
          <Button variant="secondary">Filters</Button>
          <Button>Apply</Button>
        </Toolbar>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel variant="default"><strong>Default panel</strong><p className="mt-1 text-sm text-muted-foreground">Primary content surface.</p></Panel>
        <Panel variant="subtle"><strong>Subtle panel</strong><p className="mt-1 text-sm text-muted-foreground">Quiet supporting surface.</p></Panel>
        <Panel variant="dashed"><strong>Dashed panel</strong><p className="mt-1 text-sm text-muted-foreground">Optional or drop-zone surface.</p></Panel>
      </div>

      <InteractiveCard onClick={() => undefined}>
        <SectionHeader title="Interactive card" description="One shared focus, hover, and pressed contract for navigable content." />
      </InteractiveCard>

      <EmptyState
        icon={<Download className="size-5" />}
        title="Nothing here yet"
        description="Empty states use the same hierarchy and action placement across every feature."
        actions={<><Button variant="secondary">Learn more</Button><Button>Add item</Button></>}
      />
    </div>
  )
}
