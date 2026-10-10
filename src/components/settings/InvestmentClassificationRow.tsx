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
      // Wraps on the row's own width. The media-query row put a fixed 190px select beside the name
      // from 640px of *window* up, but this card sits in a half-width column, so the name was left
      // with about thirty pixels and showed one letter. Both parts keep a floor width and the
      // select drops below the name when the row cannot hold them side by side.
      className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 bg-card py-3"
    >
      <div className="flex min-w-[10rem] flex-1 items-center gap-2.5">
        <Button size="icon"
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
          className="-ml-2 shrink-0 touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <strong className="block truncate text-label text-foreground">{value.symbol}</strong>
            <RowSyncStatus isSyncing={isSyncing} isPending={isPending} entityLabel="classification" />
          </div>
          <span className="block truncate text-caption text-muted-foreground">{value.name}</span>
        </div>
      </div>
      <div className="w-full min-w-[10rem] flex-1 pl-9 sm:w-auto sm:max-w-[13rem] sm:pl-0">
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
