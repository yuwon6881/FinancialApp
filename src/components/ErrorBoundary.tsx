import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

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
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-recover when the reset key changes (e.g. tab navigation).
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a breadcrumb for debugging without crashing the app.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

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
        <div className="flex max-w-sm flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Something went wrong</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              An unexpected error interrupted this view. Your saved and queued data is safe —
              try again, or reload the app.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={this.reset}
              className="press-scale inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted cursor-pointer"
            >
              <RotateCcw className="size-3.5" /> Try again
            </button>
            {!inline && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="press-scale inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/10 transition hover:bg-blue-700 cursor-pointer"
              >
                Reload app
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
