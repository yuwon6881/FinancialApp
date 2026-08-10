import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function AuthShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        'safe-screen-inset app-shell flex min-h-screen min-h-dvh items-center justify-center text-foreground',
        className,
      )}
    >
      {children}
    </main>
  )
}

export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'relative z-10 w-full max-w-md space-y-6 rounded-3xl border border-border/60',
        'view-enter bg-card p-6 shadow-2xl sm:p-8 md:bg-card/60 md:backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function AuthHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
}) {
  return (
    <header className="space-y-2 text-center select-none">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl">
        {icon}
      </div>
      <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </header>
  )
}

export function AuthLoadingState({ label }: { label: string }) {
  return (
    <AuthShell className="select-none">
      <div role="status" aria-live="polite" className="view-enter flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
    </AuthShell>
  )
}
