import React, { useState } from 'react'
import { KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { CollapsibleBody } from './ui/CollapsibleBody'
import { getErrorMessage } from '../lib/errors'

interface ChangePasswordSectionProps {
  hideSensitive: boolean
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
}

export const ChangePasswordSection: React.FC<ChangePasswordSectionProps> = ({ hideSensitive, onToast }) => {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hideSensitive) return

    const newErrors: Record<string, string> = {}
    if (!currentPassword.trim()) newErrors.currentPassword = 'Current password is required.'
    if (!newPassword.trim()) newErrors.newPassword = 'New password is required.'
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Confirm password is required.'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onToast?.('Password changed. Other devices have been logged out.', 'Password updated', 'success')
    } catch (err: unknown) {
      onToast?.(getErrorMessage(err, 'Failed to change password.'), 'Error', 'error')
    } finally {
      setBusy(false)
    }
  }

  const fieldClass = (key: string) =>
    `w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
      errors[key] ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-ring'
    }`

  const clearError = (key: string) => {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-5 text-left cursor-pointer"
      >
        <KeyRound className="size-5 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Change Password</h3>
          <p className="text-[11px] text-muted-foreground">Changing your password logs out every other device.</p>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
      </button>

      <CollapsibleBody open={open}>
      <div className="px-5 pb-5 border-t border-border/40 pt-4">
      <form noValidate onSubmit={handleSubmit} className="space-y-2.5">
        <div className="space-y-1">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={e => { setCurrentPassword(e.target.value); clearError('currentPassword') }}
            disabled={hideSensitive}
            autoComplete="current-password"
            className={fieldClass('currentPassword')}
          />
          {errors.currentPassword && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">{errors.currentPassword}</p>
          )}
        </div>
        <div className="space-y-1">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); clearError('newPassword') }}
            disabled={hideSensitive}
            autoComplete="new-password"
            className={fieldClass('newPassword')}
          />
          {errors.newPassword && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">{errors.newPassword}</p>
          )}
        </div>
        <div className="space-y-1">
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); clearError('confirmPassword') }}
            disabled={hideSensitive}
            autoComplete="new-password"
            className={fieldClass('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">{errors.confirmPassword}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || hideSensitive}
          className="press-scale w-full py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
        >
          {busy ? 'Updating...' : 'Change password'}
        </button>
      </form>
      </div>
      </CollapsibleBody>
    </section>
  )
}
