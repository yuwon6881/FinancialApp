import React from 'react'
import { Info } from 'lucide-react'
import { BottomSheet } from './BottomSheet'

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
        <div className="flex items-center gap-2 text-blue-500">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <Info className="size-5" />
          </span>
          <span>{title}</span>
        </div>
      }
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            {buttonText}
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
