import React from 'react'
import { Info } from 'lucide-react'

interface CustomAlertModalProps {
  isOpen: boolean
  title: string
  message: string
  buttonText?: string
  onClose: () => void
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  isOpen,
  title,
  message,
  buttonText = 'Close',
  onClose
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 text-blue-500 pb-2 border-b border-border/40">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <Info className="size-5" />
          </span>
          <h3 className="text-md font-bold text-foreground">{title}</h3>
        </div>

        <div className="text-xs leading-relaxed text-muted-foreground">
          <p>{message}</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}
