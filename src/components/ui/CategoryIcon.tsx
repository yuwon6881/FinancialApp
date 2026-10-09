import {
  ArrowLeftRight,
  Banknote,
  Car,
  CircleDashed,
  Code2,
  Coffee,
  Film,
  Gift,
  HeartPulse,
  House,
  Palette,
  Percent,
  Repeat,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  SlidersHorizontal,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { getCategoryChartColor } from '../../lib/categoryColors'

const ICON_BY_CATEGORY: Record<string, (className: string) => ReactNode> = {
  food: className => <UtensilsCrossed className={className} strokeWidth={2} />,
  dining: className => <UtensilsCrossed className={className} strokeWidth={2} />,
  groceries: className => <ShoppingBasket className={className} strokeWidth={2} />,
  grocery: className => <ShoppingBasket className={className} strokeWidth={2} />,
  transport: className => <Car className={className} strokeWidth={2} />,
  car: className => <Car className={className} strokeWidth={2} />,
  utilities: className => <Zap className={className} strokeWidth={2} />,
  bills: className => <Zap className={className} strokeWidth={2} />,
  entertainment: className => <Film className={className} strokeWidth={2} />,
  shopping: className => <ShoppingBag className={className} strokeWidth={2} />,
  health: className => <HeartPulse className={className} strokeWidth={2} />,
  medical: className => <HeartPulse className={className} strokeWidth={2} />,
  subscriptions: className => <Repeat className={className} strokeWidth={2} />,
  subscription: className => <Repeat className={className} strokeWidth={2} />,
  coffee: className => <Coffee className={className} strokeWidth={2} />,
  salary: className => <Banknote className={className} strokeWidth={2} />,
  income: className => <Banknote className={className} strokeWidth={2} />,
  interest: className => <Percent className={className} strokeWidth={2} />,
  transfer: className => <ArrowLeftRight className={className} strokeWidth={2} />,
  accountmove: className => <ArrowLeftRight className={className} strokeWidth={2} />,
  investment: className => <TrendingUp className={className} strokeWidth={2} />,
  growth: className => <TrendingUp className={className} strokeWidth={2} />,
  rewards: className => <Gift className={className} strokeWidth={2} />,
  gifts: className => <Gift className={className} strokeWidth={2} />,
  stability: className => <Shield className={className} strokeWidth={2} />,
  essentials: className => <House className={className} strokeWidth={2} />,
  social: className => <Users className={className} strokeWidth={2} />,
  hobbies: className => <Palette className={className} strokeWidth={2} />,
  software: className => <Code2 className={className} strokeWidth={2} />,
  adjustment: className => <SlidersHorizontal className={className} strokeWidth={2} />,
}

function renderIcon(category: string, className: string): ReactNode {
  const key = category.trim().toLowerCase()
  if (key.startsWith('transfer:')) return <ArrowLeftRight className={className} strokeWidth={2} />
  if (key.startsWith('incomesplit:')) return <Banknote className={className} strokeWidth={2} />
  return ICON_BY_CATEGORY[key]?.(className) ?? null
}

interface CategoryIconProps {
  category: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<NonNullable<CategoryIconProps['size']>, { box: string; icon: string; text: string }> = {
  sm: { box: 'size-8 rounded-[0.625rem]', icon: 'size-4', text: 'text-caption' },
  md: { box: 'size-10 rounded-xl', icon: 'size-[1.125rem]', text: 'text-label' },
  lg: { box: 'size-12 rounded-2xl', icon: 'size-5', text: 'text-body' },
}

/**
 * A category's mark: its chart colour as a soft tint behind its icon, so a row is recognisable at a
 * glance before it is read. Unknown categories fall back to their initials in the same colour --
 * every user-defined category keeps a stable colour slot (see lib/categoryColors). Decorative: the
 * category name is always written next to it.
 */
export function CategoryIcon({ category, size = 'md', className }: CategoryIconProps) {
  const name = (category ?? '').trim() || 'Other'
  const color = getCategoryChartColor(name)
  const icon = renderIcon(name, SIZE[size].icon)
  const dims = SIZE[size]
  const initials = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?'
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid shrink-0 place-items-center font-semibold', dims.box, className)}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {icon ?? (name.toLowerCase() === 'other' ? <CircleDashed className={dims.icon} /> : <span className={dims.text}>{initials}</span>)}
    </span>
  )
}
