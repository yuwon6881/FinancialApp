import React from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Gift,
  ScanLine,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import { InteractiveCard } from '../ui/InteractiveCard'
import { cn } from '../../lib/utils'

export type QuickAddAction =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'scan-receipt'
  | 'bill'
  | 'reward'
  | 'investment'
  | 'ask-ai'
  | 'search'

interface QuickAddSheetProps {
  isOpen: boolean
  onClose: () => void
  onAction: (action: QuickAddAction) => void
  /** Sensitive mode blocks every action that opens a blank form; reads stay available. */
  mutationsDisabled: boolean
  mutationsDisabledReason?: string
}

interface ActionSpec {
  id: QuickAddAction
  label: string
  hint: string
  icon: React.ReactNode
  /** Tint for the icon well, as a palette colour token. */
  tint: string
  mutation: boolean
}

const ACTIONS: ActionSpec[] = [
  { id: 'expense', label: 'Expense', hint: 'Money out', icon: <ArrowUpRight className="size-5" />, tint: 'var(--color-orange-500)', mutation: true },
  { id: 'income', label: 'Income', hint: 'Money in', icon: <ArrowDownLeft className="size-5" />, tint: 'var(--color-emerald-500)', mutation: true },
  { id: 'transfer', label: 'Transfer', hint: 'Between buckets', icon: <ArrowLeftRight className="size-5" />, tint: 'var(--color-sky-500)', mutation: true },
  { id: 'scan-receipt', label: 'Scan receipt', hint: 'Read it for me', icon: <ScanLine className="size-5" />, tint: 'var(--color-blue-500)', mutation: true },
  { id: 'bill', label: 'New bill', hint: 'Recurring payment', icon: <CalendarClock className="size-5" />, tint: 'var(--color-violet-500)', mutation: true },
  { id: 'reward', label: 'New reward', hint: 'Something to save for', icon: <Gift className="size-5" />, tint: 'var(--color-pink-500)', mutation: true },
  { id: 'investment', label: 'Investment', hint: 'Buy, sell or dividend', icon: <TrendingUp className="size-5" />, tint: 'var(--color-purple-500)', mutation: true },
  { id: 'ask-ai', label: 'Ask AI', hint: 'Questions and drafts', icon: <Sparkles className="size-5" />, tint: 'var(--primary)', mutation: false },
  { id: 'search', label: 'Search', hint: 'Find anything', icon: <Search className="size-5" />, tint: 'var(--color-slate-500)', mutation: false },
]

/**
 * Everything you can start from anywhere, behind the tab bar's add button. A grid rather than a
 * menu: nine targets are faster to hit with a thumb as tiles than as a list, and each tile says
 * what it records before you commit to a form.
 */
export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({
  isOpen,
  onClose,
  onAction,
  mutationsDisabled,
  mutationsDisabledReason,
}) => (
  <BottomSheet
    isOpen={isOpen}
    onClose={onClose}
    title="Quick add"
    description={mutationsDisabled ? mutationsDisabledReason : undefined}
    maxWidthClassName="max-w-lg"
  >
    <div role="menu" aria-label="Quick actions" className="grid grid-cols-3 gap-2.5">
      {ACTIONS.map(action => {
        const disabled = action.mutation && mutationsDisabled
        return (
          <InteractiveCard
            key={action.id}
            role="menuitem"
            surface="plain"
            disabled={disabled}
            title={disabled ? mutationsDisabledReason : action.label}
            onClick={() => onAction(action.id)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card px-2 py-4 text-center hover:bg-surface-2',
              'dark:bg-surface-2 dark:hover:bg-surface-3',
            )}
          >
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, ${action.tint} 16%, transparent)`, color: action.tint }}
            >
              {action.icon}
            </span>
            <span className="text-label font-semibold text-foreground">{action.label}</span>
            <span className="-mt-1.5 text-caption text-muted-foreground">{action.hint}</span>
          </InteractiveCard>
        )
      })}
    </div>
  </BottomSheet>
)
