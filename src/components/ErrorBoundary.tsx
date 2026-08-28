import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'
import { clearDisposableFinancialCaches } from '../lib/cache'
import { isChunkLoadError } from '../lib/chunkLoadError'
import { Button } from './ui/Button'
import { Panel } from './ui/Panel'

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
  /** True between a reset and the recovered subtree either mounting or crashing again. */
  retrying: boolean
  /** Consecutive resets that crashed again before the subtree could mount. */
  failedRetries: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private static readonly chunkReloadKey = 'chunk-load-reload-attempted'
  state: ErrorBoundaryState = { error: null, attempt: 0, retrying: false, failedRetries: 0 }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-recover when the reset key changes (e.g. tab navigation).
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
      return
    }
    // The recovered subtree committed without throwing, so the retry worked and the
    // escalation copy must go away. A crash during that render never reaches here —
    // it re-renders the boundary into its fallback and lands in componentDidCatch.
    if (!this.state.error && this.state.retrying) {
      this.setState({ retrying: false, failedRetries: 0 })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a breadcrumb for debugging without crashing the app.
    console.error('[ErrorBoundary]', error, info.componentStack)

    // A crash while retrying means the same fallback is about to be re-rendered
    // unchanged, so "Try again" looks like a dead button. Count it, and let render
    // say so and offer the recovery paths that can actually clear the cause.
    if (this.state.retrying) {
      this.setState(state => ({ retrying: false, failedRetries: state.failedRetries + 1 }))
    }

    // Automatically recover from Vite chunk load errors when a new version is deployed.
    if (isChunkLoadError(error)) {
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
  reset = () =>
    this.setState(state => ({ error: null, attempt: state.attempt + 1, retrying: true }))

  // Last-resort recovery: the crash is often caused by a stale/malformed
  // server-derived cache record that gets reloaded from localStorage on every render, so
  // "Try again" and "Reload app" alone can loop forever on the same crash.
  // Clearing just the cached data caches (not auth) forces a fresh fetch.
  clearCacheAndReload = () => {
    clearDisposableFinancialCaches()
    window.location.reload()
  }

  render() {
    const { error, attempt, failedRetries } = this.state
    if (!error) return <Fragment key={attempt}>{this.props.children}</Fragment>

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    const inline = this.props.variant === 'inline'
    // Once retrying has visibly failed, the honest thing is to say so and put the
    // recovery paths that can clear the cause on screen — including in the inline
    // variant, which otherwise offers nothing but the button that just did nothing.
    const retryFailed = failedRetries > 0
    const ErrorShell = inline ? Panel : 'div'

    return (
      <ErrorShell
        role="alert"
        className={
          inline
            ? 'p-8 text-center'
            : 'safe-screen-inset app-shell min-h-screen min-h-dvh flex items-center justify-center text-foreground [--safe-screen-block:1.5rem] [--safe-screen-inline:1.5rem]'
        }
      >
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1.5 text-center">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Something went wrong</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {retryFailed
                ? 'Trying again ran into the same problem, so it will not clear on its own. Your saved and queued data is safe — reload the app, and if that does not help, clear the data kept on this device.'
                : 'An unexpected error interrupted this view. Your saved and queued data is safe — try again, or reload the app.'}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              onClick={this.reset}
              className="rounded-xl px-4"
            >
              <RotateCcw className="size-3.5" /> Try again
            </Button>
            {(!inline || retryFailed) && (
              <Button
                onClick={() => window.location.reload()}
                className="rounded-xl px-4 shadow-md shadow-primary/10"
              >
                Reload app
              </Button>
            )}
          </div>
          {error.message && (
            <details className="w-full text-left">
              <summary className="cursor-pointer text-xs font-bold text-muted-foreground">
                What went wrong
              </summary>
              <p className="mt-1.5 break-words rounded-lg bg-muted/60 p-2 text-xs leading-relaxed text-muted-foreground">
                {error.message}
              </p>
            </details>
          )}
          {(!inline || retryFailed) && (
            <Button
              variant="destructiveGhost"
              size="sm"
              onClick={this.clearCacheAndReload}
              className="text-xs"
            >
              <Trash2 className="size-3" /> Still stuck? Clear local data and reload
            </Button>
          )}
        </div>
      </ErrorShell>
    )
  }
}
