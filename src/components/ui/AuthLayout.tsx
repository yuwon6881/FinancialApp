import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { AppLogo } from './AppLogo'

const BUCKETS = [
  { name: 'Essentials', share: 50 },
  { name: 'Growth', share: 25 },
  { name: 'Stability', share: 15 },
  { name: 'Rewards', share: 10 },
] as const

/**
 * The wide-screen half beside every sign-in step: what the app does, in its own terms. A flat Iris
 * field (the design language has no gradients) carrying the brand mark, one promise, and the
 * four-bucket split the whole product is built around, drawn the way the app draws it.
 */
function AuthBrandPanel() {
  return (
    <aside aria-hidden="true" className="relative hidden flex-col justify-between overflow-hidden bg-brand p-12 text-brand-foreground lg:flex xl:p-16">
      <div className="flex items-center gap-3">
        <AppLogo className="size-10 rounded-xl ring-1 ring-brand-foreground/25" />
        <span className="text-section">FinancialApp</span>
      </div>

      <div className="max-w-md">
        <p className="text-hero leading-[1.05] tracking-tight">Every pay, given a job.</p>
        <p className="mt-4 text-callout text-brand-foreground/75">
          Split each salary across Essentials, Growth, Stability and Rewards, then see exactly what is safe to spend today.
        </p>

        <div className="mt-10 rounded-panel bg-brand-foreground/10 p-5 ring-1 ring-brand-foreground/15">
          <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
            {BUCKETS.map((bucket, index) => (
              <span key={bucket.name} className="h-full rounded-full bg-brand-foreground" style={{ width: `${bucket.share}%`, opacity: 1 - index * 0.2 }} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-label">
            {BUCKETS.map((bucket, index) => (
              <li key={bucket.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-brand-foreground" style={{ opacity: 1 - index * 0.2 }} />
                  {bucket.name}
                </span>
                <span className="tabular-nums text-brand-foreground/75">{bucket.share}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-caption text-brand-foreground/60">Private by design · your figures stay masked until you choose to show them</p>
    </aside>
  )
}

export function AuthShell({ children, className, brand = true }: { children: ReactNode; className?: string; brand?: boolean }) {
  return (
    <main
      className={cn(
        'min-h-screen min-h-dvh bg-background text-foreground',
        brand && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        className,
      )}
    >
      {brand && <AuthBrandPanel />}
      <div className="safe-screen-inset flex min-h-screen min-h-dvh items-center justify-center">
        {children}
      </div>
    </main>
  )
}

/** The form column: no card chrome -- the canvas is the surface, the content is the focus. */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('view-enter relative z-10 w-full max-w-sm space-y-7', className)}>
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
    <header className="space-y-3 select-none">
      <div className="flex size-12 items-center justify-center">
        {icon}
      </div>
      <h1 className="text-display text-foreground">{title}</h1>
      {description && <p className="text-body text-muted-foreground">{description}</p>}
    </header>
  )
}

export function AuthLoadingState({ label }: { label: string }) {
  return (
    <AuthShell className="select-none" brand={false}>
      <div role="status" aria-live="polite" className="view-enter flex flex-col items-center gap-4">
        <AppLogo className="size-12 rounded-2xl" animated />
        <p className="text-label text-muted-foreground">{label}</p>
      </div>
    </AuthShell>
  )
}
