import type { HTMLAttributes, ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'

export type AlertBannerVariant = 'error' | 'warning' | 'info' | 'success'

const STYLES: Record<AlertBannerVariant, string> = {
  error: 'border-destructive/25 bg-destructive/10 text-destructive',
  warning: 'border-orange-500/25 bg-orange-500/10 text-orange-500',
  info: 'border-blue-500/25 bg-blue-500/10 text-blue-500',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
}

const ICONS: Record<AlertBannerVariant, LucideIcon> = {
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
  success: CheckCircle2,
}

export interface AlertBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertBannerVariant
  children: ReactNode
  title?: ReactNode
}

export function AlertBanner({
  variant = 'info',
  title,
  children,
  className,
  role,
  ...props
}: AlertBannerProps) {
  const Icon = ICONS[variant]
  return (
    <div
      role={role ?? (variant === 'error' ? 'alert' : 'status')}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed',
        STYLES[variant],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  )
}
