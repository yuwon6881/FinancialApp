import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Panel } from './Panel'

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function EmptyState({ icon, title, description, actions, className, ...props }: EmptyStateProps) {
  return (
    <Panel variant="dashed" padding="spacious" role="status" className={cn('text-center', className)} {...props}>
      {icon && <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-border/60 bg-muted/35 text-muted-foreground">{icon}</div>}
      <h2 className="mt-4 text-base font-bold text-foreground">{title}</h2>
      {description && <div className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</div>}
      {actions && <div className="mx-auto mt-5 flex max-w-md flex-col-reverse justify-center gap-2 sm:flex-row">{actions}</div>}
    </Panel>
  )
}
