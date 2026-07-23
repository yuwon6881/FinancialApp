import { useState, useCallback } from 'react'
import type { ToastMessage, ToastTone, ToastAction } from '../components/ui/ToastViewport'

export interface AppDialogs {
  customAlert: { message: string; title: string } | null
  setCustomAlert: (alert: { message: string; title: string } | null) => void
  showAlert: (message: string, title?: string) => void
  confirmModalData: {
    title: string
    message: React.ReactNode
    confirmText?: string
    confirmDisabled?: boolean
    variant?: 'danger' | 'primary'
    onConfirm: () => void
  } | null
  setConfirmModalData: (data: any) => void
  toasts: ToastMessage[]
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  dismissToast: (id: string) => void
  showFailedOpsModal: boolean
  setShowFailedOpsModal: (value: boolean) => void
  showLoginModal: boolean
  setShowLoginModal: (value: boolean) => void
}

export function useAppDialogs(): AppDialogs {
  const [customAlert, setCustomAlert] = useState<{ message: string; title: string } | null>(null)
  const [confirmModalData, setConfirmModalData] = useState<{
    title: string
    message: React.ReactNode
    confirmText?: string
    confirmDisabled?: boolean
    variant?: 'danger' | 'primary'
    onConfirm: () => void
  } | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const [showFailedOpsModal, setShowFailedOpsModal] = useState<boolean>(false)
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false)

  const showToast = useCallback((message: string, title = 'Notification', tone: ToastTone = 'info', action?: ToastAction) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
    setToasts(prev => [...prev.slice(-3), { id, message, title, tone, action }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const showAlert = useCallback((message: string, title = 'Notification') => {
    showToast(message, title, title.toLowerCase().includes('error') ? 'error' : 'info')
  }, [showToast])

  return {
    customAlert,
    setCustomAlert,
    showAlert,
    confirmModalData,
    setConfirmModalData,
    toasts,
    setToasts,
    showToast,
    dismissToast,
    showFailedOpsModal,
    setShowFailedOpsModal,
    showLoginModal,
    setShowLoginModal,
  }
}
