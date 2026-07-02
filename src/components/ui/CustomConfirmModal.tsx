import React from 'react'
import { AlertCircle } from 'lucide-react'
import { BottomSheet } from './BottomSheet'

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
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onCancel}
      maxWidthClassName="max-w-md"
      title={
        <div className="flex items-center gap-2 text-orange-500">
          <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
            <AlertCircle className="size-5" />
          </span>
          <span>{title}</span>
        </div>
      }
      footer={
        <div className="flex justify-end gap-3">
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
      }
    >
      <div className="text-xs leading-relaxed text-muted-foreground">
        <p>{message}</p>
      </div>
    </BottomSheet>
  )
}
