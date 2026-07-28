import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'
import { CACHE_KEYS } from '../lib/cache'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional custom fallback. When omitted, a friendly default card is shown. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /**
   * Changing this value resets the boundary (e.g. pass the active tab so a
   * per-view crash clears itself when the user navigates elsewhere).
   */
  resetKey?: unknown
  /** Whether to show the full-screen shell (root boundary) or an inline card. */
  variant?: 'screen' | 'inline'
}

interface ErrorBoundaryState {
  error: Error | null
  /** Bumped on every reset so the recovered subtree is re-keyed and fully remounts. */
  attempt: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private static readonly chunkReloadKey = 'chunk-load-reload-attempted'
  state: ErrorBoundaryState = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-recover when the reset key changes (e.g. tab navigation).
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a breadcrumb for debugging without crashing the app.
    console.error('[ErrorBoundary]', error, info.componentStack)

    // Automatically recover from Vite chunk load errors when a new version is deployed.
    if (
      error.message &&
      (error.message.includes('Failed to fetch dynamically imported module') ||
       error.message.includes('Importing a module script failed'))
    ) {
      if (sessionStorage.getItem(ErrorBoundary.chunkReloadKey) !== '1') {
        sessionStorage.setItem(ErrorBoundary.chunkReloadKey, '1')
        console.warn('Chunk load error detected, triggering one hard reload...')
        window.location.reload()
      } else {
        console.error('Chunk load error persisted after the automatic reload.')
      }
    }
  }

  // Clear the error AND bump `attempt`, which re-keys the recovered subtree below
  // so it fully unmounts/remounts. Nulling the error alone re-renders the same
  // element instances, so any crash driven by stale component state would rethrow
  // on the very next render and "Try again" would appear to do nothing.
  reset = () => this.setState(state => ({ error: null, attempt: state.attempt + 1 }))

  // Last-resort recovery: the crash is often caused by a stale/malformed
  // cached record (e.g. a pending or draft transaction persisted before a
  // schema change) that gets reloaded from localStorage on every render, so
  // "Try again" and "Reload app" alone can loop forever on the same crash.
  // Clearing just the cached data caches (not auth) forces a fresh fetch.
  clearCacheAndReload = () => {
    Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key))
    localStorage.removeItem('draft_transactions')
    localStorage.removeItem('pending_transactions_backup')
    window.location.reload()
  }

  render() {
    const { error, attempt } = this.state
    if (!error) return <Fragment key={attempt}>{this.props.children}</Fragment>

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    const inline = this.props.variant === 'inline'

    return (
      <div
        role="alert"
        className={
          inline
            ? 'app-panel rounded-2xl border border-border/60 bg-card/92 p-8 text-center'
            : 'app-shell min-h-screen flex items-center justify-center p-6 text-foreground'
        }
      >
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1.5 text-center">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Something went wrong</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              An unexpected error interrupted this view. Your saved and queued data is safe —
              try again, or reload the app.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="press-scale inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted cursor-pointer"
            >
              <RotateCcw className="size-3.5" /> Try again
            </button>
            {!inline && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="press-scale inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/10 transition hover:bg-primary/90 cursor-pointer"
              >
                Reload app
              </button>
            )}
          </div>
          {!inline && (
            <button
              type="button"
              onClick={this.clearCacheAndReload}
              className="press-scale inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70 hover:text-orange-500 transition cursor-pointer"
            >
              <Trash2 className="size-3" /> Still stuck? Clear local data and reload
            </button>
          )}
        </div>
      </div>
    )
  }
}
