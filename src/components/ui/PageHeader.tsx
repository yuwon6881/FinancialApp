import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Panel } from './Panel'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  titleId?: string
}

export function PageHeader({
  title,
  description,
  icon,
  leading,
  actions,
  children,
  className,
  titleId,
}: PageHeaderProps) {
  return (
    <Panel as="header" padding="spacious" className={cn('relative z-30', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {leading && <div className="shrink-0">{leading}</div>}
          {icon && <div className="shrink-0" aria-hidden="true">{icon}</div>}
          <div className="min-w-0">
            <h1 id={titleId} className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {description && <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
      </div>
      {children}
    </Panel>
  )
}
