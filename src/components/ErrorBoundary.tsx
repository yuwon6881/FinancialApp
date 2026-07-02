import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level safety net. A render error anywhere in the tree would otherwise
 * white-screen the whole PWA; here we catch it and show a recoverable card.
 * Crucially we do NOT clear localStorage, so the offline sync queue, drafts
 * and cached ledger survive a reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced in the console / any attached logging; kept non-fatal.
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="app-shell min-h-screen flex items-center justify-center p-6 text-foreground">
        <div className="app-panel max-w-md w-full rounded-2xl border border-border/60 bg-card/92 p-8 text-center soft-rise">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="mt-5 text-lg font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The app hit an unexpected error. Your data is safe — nothing was lost.
            Reloading usually fixes it.
          </p>
          {this.state.error?.message && (
            <p className="mt-3 text-[11px] font-mono text-muted-foreground/70 bg-muted/50 rounded-lg px-3 py-2 break-words">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReload}
            className="press-scale mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer"
          >
            <RotateCw className="size-4" /> Reload app
          </button>
        </div>
      </div>
    )
  }
}
