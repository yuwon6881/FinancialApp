import React from 'react'
import { Info } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import { ModalActions } from './ModalActions'

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
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-sm"
      title={
        <div className="flex items-center gap-2 text-accent-ink">
          <span className="p-1.5 rounded-lg bg-primary/10 text-accent-ink">
            <Info className="size-5" />
          </span>
          <span>{title}</span>
        </div>
      }
      footer={
        <ModalActions>
          <Button onClick={onClose} className="rounded-xl px-5 shadow-md">
            {buttonText}
          </Button>
        </ModalActions>
      }
    >
      <div className="text-xs leading-relaxed text-muted-foreground">
        <p>{message}</p>
      </div>
    </BottomSheet>
  )
}
