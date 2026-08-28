import { CheckCircle2, X, AlertCircle } from 'lucide-react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { Button } from '../../ui/Button'

interface ReceiptScanStatusProps {
  showScanBanner: boolean
  setShowScanBanner: (value: boolean) => void
  scanError: string | null
  setScanError: (err: string | null) => void
  successMessage?: string
}

export function ReceiptScanStatus({
  showScanBanner,
  setShowScanBanner,
  scanError,
  setScanError,
  successMessage = 'Receipt scanned — review fields below and edit as needed',
}: ReceiptScanStatusProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="sm:col-span-2 space-y-2">
      <AnimatePresence>
        {showScanBanner && (
          <m.div
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
          >
            <div className="flex min-w-0 items-center gap-1.5 break-words text-xs font-medium">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
              {successMessage}
            </div>
            <Button
              variant="unstyled"
              size="icon"
              type="button"
              onClick={() => setShowScanBanner(false)}
              aria-label="Dismiss receipt scan success"
              className="-my-2 -mr-2 shrink-0 rounded-lg text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanError && (
          <m.div
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            role="alert"
            aria-atomic="true"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{scanError}</span>
            </div>
            <Button
              variant="unstyled"
              size="icon"
              type="button"
              onClick={() => setScanError(null)}
              aria-label="Dismiss receipt scan error"
              className="-my-2 -mr-2 shrink-0 rounded-lg text-destructive transition hover:bg-destructive/10"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
