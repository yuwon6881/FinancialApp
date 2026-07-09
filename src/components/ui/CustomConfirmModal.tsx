import React from 'react'
import { AlertCircle } from 'lucide-react'
import { BottomSheet } from './BottomSheet'

interface CustomConfirmModalProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const CustomConfirmModal: React.FC<CustomConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDisabled = false,
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
            disabled={confirmDisabled}
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-orange-600"
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="text-xs leading-relaxed text-muted-foreground">
        {typeof message === 'string' ? <p>{message}</p> : message}
      </div>
    </BottomSheet>
  )
}
