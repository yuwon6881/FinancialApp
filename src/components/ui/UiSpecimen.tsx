import { Download, Plus, Trash2 } from 'lucide-react'
import { AmountText } from './AmountText'
import { Badge, StatusBadge } from './Badge'
import { Button } from './Button'
import { CategoryIcon } from './CategoryIcon'
import { EmptyState } from './EmptyState'
import { IconButton } from './IconButton'
import { Input } from './Input'
import { ListRow } from './ListRow'
import { Meter } from './Meter'
import { PageHeader } from './PageHeader'
import { Panel } from './Panel'
import { PillSwitch } from './PillSwitch'
import { ProgressRing } from './ProgressRing'
import { SectionHeader } from './SectionHeader'
import { SegmentedMeter } from './SegmentedMeter'
import { Sparkline } from './Sparkline'
import { StatTile } from './StatTile'
import { Tabs } from './Tabs'
import { Toolbar } from './Toolbar'
import { InteractiveCard } from './InteractiveCard'

const TREND = [4200, 4310, 4180, 4420, 4610, 4580, 4790, 4940, 4880, 5120]

export function UiSpecimen() {
  return (
    <div className="space-y-6" aria-label="Lumen interface specimen">
      <PageHeader
        title="Lumen interface"
        description="Canonical actions, figures, controls, status, and surfaces used throughout FinancialApp."
        actions={<Button><Plus className="size-4" />Primary action</Button>}
      />

      <Panel className="space-y-5">
        <SectionHeader title="Figures" description="Money is the hero: tabular digits, a quiet currency marker and quieter cents." />
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <AmountText value={22489.55} className="text-jumbo" />
          <AmountText value={1240.5} signDisplay="always" tone="positive" className="text-title" />
          <AmountText value={-86.4} className="text-section" />
          <AmountText value={0} isMasked className="text-section" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Available now" value={<AmountText value={9670.35} />} hint="After pending bills" aside={<Sparkline values={TREND} />} />
          <StatTile label="Cycle" value="Day 12 of 30" hint="18 days left" aside={<ProgressRing percent={40} label="Cycle progress" size={44} thickness={4} />} />
          <StatTile label="Emergency fund" value="68%" hint="RM 10,180 of RM 15,000" aside={<ProgressRing percent={68} label="Emergency fund" size={44} thickness={4} color="var(--color-emerald-500)" />} />
        </div>
        <Meter percent={62} label="Essentials used" />
        <SegmentedMeter
          label="Income split: Essentials 50%, Growth 25%, Stability 15%, Rewards 10%"
          size="lg"
          segments={[
            { label: 'Essentials', value: 50, color: 'var(--color-sky-500)' },
            { label: 'Growth', value: 25, color: 'var(--color-violet-500)' },
            { label: 'Stability', value: 15, color: 'var(--color-emerald-500)' },
            { label: 'Rewards', value: 10, color: 'var(--color-pink-500)' },
          ]}
        />
      </Panel>

      <Panel className="space-y-5">
        <SectionHeader title="Actions" description="Pills for actions, ink for the one that matters." />
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
          <PillSwitch checked onChange={() => undefined} ariaLabel="Specimen switch on" />
          <PillSwitch checked={false} onChange={() => undefined} ariaLabel="Specimen switch off" />
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

      <Panel padding="none" className="divide-y divide-border/70 px-4 sm:px-5">
        <ListRow leading={<CategoryIcon category="Groceries" />} title="Jaya Grocer" subtitle="Groceries · Maybank Savings" trailing={<AmountText value={-142.8} signDisplay="never" />} trailingSubtitle="Today" />
        <ListRow leading={<CategoryIcon category="Salary" />} title="Salary — Acme Sdn Bhd" subtitle="Income · split four ways" trailing={<AmountText value={7200} signDisplay="always" tone="positive" />} trailingSubtitle="28 Sep" />
        <ListRow leading={<CategoryIcon category="Pet supplies" />} title="Pet Lovers Centre" subtitle="Pet supplies · CIMB Visa" trailing={<AmountText value={-64.9} signDisplay="never" />} trailingSubtitle="27 Sep" />
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel variant="default"><strong>Default panel</strong><p className="mt-1 text-body text-muted-foreground">Primary content surface.</p></Panel>
        <Panel variant="subtle"><strong>Subtle panel</strong><p className="mt-1 text-body text-muted-foreground">Quiet supporting surface.</p></Panel>
        <Panel variant="dashed"><strong>Dashed panel</strong><p className="mt-1 text-body text-muted-foreground">Optional or drop-zone surface.</p></Panel>
      </div>

      <InteractiveCard onClick={() => undefined} className="p-5">
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
