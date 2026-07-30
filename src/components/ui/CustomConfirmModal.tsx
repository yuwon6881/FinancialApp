import React from 'react'
import { AlertCircle, Info } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import { ModalActions } from './ModalActions'

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
        <ModalActions>
          <Button variant="outline" onClick={onCancel} className="rounded-xl px-4">
            {cancelText}
          </Button>
          <Button
            variant={isPrimary ? 'primary' : 'destructive'}
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-xl px-5 shadow-md"
          >
            {confirmText}
          </Button>
        </ModalActions>
      }
    >
      <div className="text-xs leading-relaxed text-muted-foreground">
        {typeof message === 'string' ? <p>{message}</p> : message}
      </div>
    </BottomSheet>
  )
}
