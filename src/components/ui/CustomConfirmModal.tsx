import React from 'react'
import { AlertCircle, Info } from 'lucide-react'
import { BottomSheet } from './BottomSheet'

interface CustomConfirmModalProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  confirmDisabled?: boolean
  variant?: 'danger' | 'primary'
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
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  const isPrimary = variant === 'primary'
  const Icon = isPrimary ? Info : AlertCircle
  const colorClass = isPrimary ? 'text-blue-500' : 'text-orange-500'
  const bgClass = isPrimary ? 'bg-blue-500/10' : 'bg-orange-500/10'
  // The text colour belongs to each fill: the accent fill is light in dark mode, so
  // it pairs with the surface colour, never white.
  const buttonClass = isPrimary
    ? 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:hover:bg-primary'
    : 'bg-orange-600 text-white hover:bg-orange-700 disabled:hover:bg-orange-600'

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onCancel}
      maxWidthClassName="max-w-md"
      title={
        <div className={`flex items-center gap-2 ${colorClass}`}>
          <span className={`p-1.5 rounded-lg ${bgClass} ${colorClass}`}>
            <Icon className="size-5" />
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
            className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${buttonClass}`}
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
