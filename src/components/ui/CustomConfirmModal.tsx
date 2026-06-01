import React from 'react'
import { AlertCircle } from 'lucide-react'

interface CustomConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export const CustomConfirmModal: React.FC<CustomConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 text-orange-500 pb-2 border-b border-border/40">
          <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
            <AlertCircle className="size-5" />
          </span>
          <h3 className="text-md font-bold text-foreground">{title}</h3>
        </div>

        <div className="text-xs leading-relaxed text-muted-foreground">
          <p>{message}</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
