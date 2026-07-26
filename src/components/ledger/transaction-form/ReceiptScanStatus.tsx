import { CheckCircle2, X, AlertCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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
  return (
    <div className="sm:col-span-2 space-y-2">
      <AnimatePresence>
        {showScanBanner && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {successMessage}
            </div>
            <button
              type="button"
              onClick={() => setShowScanBanner(false)}
              className="shrink-0 text-emerald-500/60 hover:text-emerald-500 transition cursor-pointer"
            >
              <X className="size-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{scanError}</span>
            </div>
            <button
              type="button"
              onClick={() => setScanError(null)}
              className="shrink-0 text-destructive/60 hover:text-destructive transition cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
