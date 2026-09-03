import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import type { InvestmentAllocationOverview, InvestmentAllocationSleeve } from '../../types'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { RowSyncStatus } from '../ui/RowSyncBadge'

interface InvestmentClassificationRowProps {
  value: InvestmentAllocationOverview['assignments'][number]
  classify: (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => void
  onReorderFinished: () => void
  onMove: (direction: -1 | 1) => void
  position: number
  count: number
  isSyncing: boolean
  isPending: boolean
  orderBusy: boolean
  mutationsDisabled: boolean
}

export function InvestmentClassificationRow({
  value,
  classify,
  onReorderFinished,
  onMove,
  position,
  count,
  isSyncing,
  isPending,
  orderBusy,
  mutationsDisabled,
}: InvestmentClassificationRowProps) {
  const controls = useDragControls()
  const reduceMotion = useReducedMotion()
  const isBusy = mutationsDisabled || isSyncing || isPending || orderBusy

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onReorderFinished}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
      whileDrag={reduceMotion ? undefined : { scale: 1.015, boxShadow: 'var(--app-shadow)' }}
      className="flex flex-col gap-2.5 rounded-xl border border-border/50 bg-card/60 p-3 shadow-2xs transition-colors hover:border-border/80 sm:flex-row sm:items-center sm:gap-3 w-full min-w-0 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Button
          variant="tertiary"
          type="button"
          aria-label={`Reorder ${value.symbol}. Position ${position} of ${count}. Use Up or Down arrow keys.`}
          aria-keyshortcuts="ArrowUp ArrowDown"
          onPointerDown={event => controls.start(event)}
          onKeyDown={event => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            onMove(event.key === 'ArrowUp' ? -1 : 1)
          }}
          disabled={isBusy}
          className="inline-flex size-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground/70 transition hover:bg-muted/40 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <strong className="block truncate text-xs font-bold text-foreground">{value.symbol}</strong>
            <RowSyncStatus isSyncing={isSyncing} isPending={isPending} entityLabel="classification" />
          </div>
          <span className="block truncate text-xs text-muted-foreground">{value.name}</span>
        </div>
      </div>
      <div className="w-full sm:w-[190px] shrink-0 min-w-0">
        <CustomSelect
          ariaLabel={`Classify ${value.symbol}`}
          value={value.sleeve ?? ''}
          onChange={next => classify(value.instrumentId, String(next) === '' ? undefined : String(next) as InvestmentAllocationSleeve)}
          disabled={isBusy}
          options={[
            { value: '', label: 'Unassigned' },
            { value: 'USEquity', label: 'US Equity' },
            { value: 'InternationalExUS', label: 'International ex-US' },
            { value: 'Bonds', label: 'Bonds' },
          ]}
          className="w-full"
        />
      </div>
    </Reorder.Item>
  )
}
