import { Loader2 } from 'lucide-react'
import { AlertBanner } from '../../ui/AlertBanner'
import { Button } from '../../ui/Button'

interface DocumentsLoadErrorProps {
  message: string
  isLoading: boolean
  onRetry: () => void
}

export function DocumentsLoadError({ message, isLoading, onRetry }: DocumentsLoadErrorProps) {
  return (
    <AlertBanner variant="error" title="Documents unavailable" className="mb-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 break-words">{message}</p>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          disabled={isLoading}
          onClick={onRetry}
          className="min-h-11 w-full shrink-0 self-center justify-center bg-card hover:bg-card sm:min-h-8 sm:w-auto sm:self-auto"
        >
          {isLoading ? <><Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Retrying…</> : 'Try again'}
        </Button>
      </div>
    </AlertBanner>
  )
}
