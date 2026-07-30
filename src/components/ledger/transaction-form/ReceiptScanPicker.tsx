import { Input } from '../../ui/Input'
import React from 'react'
import { Calculator, Camera, Image, X, Loader2 } from 'lucide-react'
import { PerimeterBeam } from '../../ui/PerimeterBeam'

interface ReceiptScanPickerProps {
  isScanning: boolean
  showScanPicker: boolean
  setShowScanPicker: (value: boolean) => void
  scanFileInputRef: React.RefObject<HTMLInputElement | null>
  scanGalleryInputRef: React.RefObject<HTMLInputElement | null>
  handleScanReceipt: (file: File) => void
  setScanError: (err: string | null) => void
  label?: string
  scanningLabel?: string
  /**
   * Shared-receipt scanning. Flat props rather than one `split` object because the
   * refs would then be reached through a prop object, which counts as reading a ref
   * during render. Without handleSplitScan the second button is not rendered.
   */
  handleSplitScan?: (file: File) => void
  isSplitScanning?: boolean
  showSplitPicker?: boolean
  setShowSplitPicker?: (value: boolean) => void
  splitCameraInputRef?: React.RefObject<HTMLInputElement | null>
  splitGalleryInputRef?: React.RefObject<HTMLInputElement | null>
}

// Shared by both pickers' source rows. The rows themselves are written inline
// rather than extracted into a component: the file inputs are reached through refs,
// and a ref passed as a component prop is a render-time read the compiler rejects.
const SOURCE_BUTTON = 'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-accent-ink transition duration-200 text-xs font-semibold cursor-pointer'
const CANCEL_BUTTON = 'flex items-center justify-center px-3 py-2.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-muted-foreground transition duration-200 text-xs font-semibold cursor-pointer'

export function ReceiptScanPicker({
  isScanning,
  showScanPicker,
  setShowScanPicker,
  scanFileInputRef,
  scanGalleryInputRef,
  handleScanReceipt,
  setScanError,
  label = 'Scan Receipt',
  scanningLabel = 'Scanning receipt...',
  handleSplitScan,
  isSplitScanning = false,
  showSplitPicker = false,
  setShowSplitPicker,
  splitCameraInputRef,
  splitGalleryInputRef,
}: ReceiptScanPickerProps) {
  // Keyed off the callbacks, not the refs: `Boolean(ref)` counts as handing a ref to
  // a function, and the two always arrive together anyway.
  const splitEnabled = handleSplitScan !== undefined && setShowSplitPicker !== undefined
  const busy = isScanning || isSplitScanning
  // Either picker takes over the whole row, so the buttons it replaces never
  // shift position while a source is being chosen.
  const pickingSource = (showScanPicker || showSplitPicker) && !busy

  return (
    <div className="sm:col-span-2">
      <Input
        ref={scanFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) { setShowScanPicker(false); handleScanReceipt(file) }
        }}
      />
      <Input
        ref={scanGalleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) { setShowScanPicker(false); handleScanReceipt(file) }
        }}
      />
      {splitEnabled && (
        <>
          <Input
            ref={splitCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) { setShowSplitPicker?.(false); handleSplitScan?.(file) }
            }}
          />
          <Input
            ref={splitGalleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) { setShowSplitPicker?.(false); handleSplitScan?.(file) }
            }}
          />
        </>
      )}

      {!pickingSource && (
        <div className={splitEnabled ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : ''}>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setScanError(null)
              if (!busy) setShowScanPicker(true)
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition duration-200 text-xs font-semibold cursor-pointer ${
              isScanning
                ? 'perimeter-beam-host border-primary/20 bg-primary/5 text-accent-ink cursor-not-allowed relative overflow-hidden'
                : 'border-primary/40 bg-primary/5 hover:bg-primary/10 text-accent-ink disabled:opacity-45 disabled:cursor-not-allowed'
            }`}
          >
            {isScanning && <PerimeterBeam size={40} />}
            {isScanning ? (
              <><Loader2 className="size-3.5 animate-spin" /> {scanningLabel}</>
            ) : (
              <><Camera className="size-3.5" /><span>{label}</span></>
            )}
          </button>
          {splitEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setScanError(null)
                if (!busy) setShowSplitPicker?.(true)
              }}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition duration-200 text-xs font-semibold cursor-pointer ${
                isSplitScanning
                  ? 'perimeter-beam-host border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400 cursor-not-allowed relative overflow-hidden'
                  : 'border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 disabled:opacity-45 disabled:cursor-not-allowed'
              }`}
            >
              {isSplitScanning && <PerimeterBeam size={40} />}
              {isSplitScanning ? (
                <><Loader2 className="size-3.5 animate-spin" /> Reading receipt items...</>
              ) : (
                <><Calculator className="size-3.5" /> Calculate My Share</>
              )}
            </button>
          )}
        </div>
      )}

      {pickingSource && showScanPicker && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scanFileInputRef.current?.click()}
            className={SOURCE_BUTTON}
          >
            <Camera className="size-3.5" /> Take Photo
          </button>
          <button
            type="button"
            onClick={() => scanGalleryInputRef.current?.click()}
            className={SOURCE_BUTTON}
          >
            <Image className="size-3.5" /> Upload Photo
          </button>
          <button
            type="button"
            onClick={() => setShowScanPicker(false)}
            aria-label="Cancel"
            className={CANCEL_BUTTON}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {pickingSource && !showScanPicker && showSplitPicker && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => splitCameraInputRef?.current?.click()}
            className={SOURCE_BUTTON}
          >
            <Camera className="size-3.5" /> Take Photo
          </button>
          <button
            type="button"
            onClick={() => splitGalleryInputRef?.current?.click()}
            className={SOURCE_BUTTON}
          >
            <Image className="size-3.5" /> Upload Photo
          </button>
          <button
            type="button"
            onClick={() => setShowSplitPicker?.(false)}
            aria-label="Cancel"
            className={CANCEL_BUTTON}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
