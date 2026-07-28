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
  onCalculateShare?: () => void
}

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
  onCalculateShare,
}: ReceiptScanPickerProps) {
  return (
    <div className="sm:col-span-2">
      <input
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
      <input
        ref={scanGalleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) { setShowScanPicker(false); handleScanReceipt(file) }
        }}
      />

      {!showScanPicker && (
        <div className={onCalculateShare ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : ''}>
          <button
            type="button"
            disabled={isScanning}
            onClick={() => {
              setScanError(null)
              if (!isScanning) setShowScanPicker(true)
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border transition duration-200 text-xs font-semibold cursor-pointer ${
              isScanning
                ? 'perimeter-beam-host border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 cursor-not-allowed relative overflow-hidden'
                : 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }`}
          >
            {isScanning && <PerimeterBeam size={40} />}
            {isScanning ? (
              <><Loader2 className="size-3.5 animate-spin" /> {scanningLabel}</>
            ) : (
              <><Camera className="size-3.5" /><span>{label}</span></>
            )}
          </button>
          {onCalculateShare && !isScanning && (
            <button
              type="button"
              onClick={onCalculateShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-teal-500/40 bg-teal-500/5 hover:bg-teal-500/10 text-teal-600 dark:text-teal-400 transition duration-200 text-xs font-semibold cursor-pointer"
            >
              <Calculator className="size-3.5" /> Calculate My Share
            </button>
          )}
        </div>
      )}

      {showScanPicker && !isScanning && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scanFileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition duration-200 text-xs font-semibold cursor-pointer"
          >
            <Camera className="size-3.5" /> Take Photo
          </button>
          <button
            type="button"
            onClick={() => scanGalleryInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition duration-200 text-xs font-semibold cursor-pointer"
          >
            <Image className="size-3.5" /> Upload Photo
          </button>
          <button
            type="button"
            onClick={() => setShowScanPicker(false)}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-muted-foreground transition duration-200 text-xs font-semibold cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
