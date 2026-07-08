import React, { useState } from 'react'
import { KeyRound } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'

interface ChangePasswordSectionProps {
  hideSensitive: boolean
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
}

export const ChangePasswordSection: React.FC<ChangePasswordSectionProps> = ({ hideSensitive, onToast }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hideSensitive) return
    if (newPassword !== confirmPassword) {
      onToast?.('New passwords do not match.', 'Error', 'error')
      return
    }
    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onToast?.('Password changed. Other devices have been logged out.', 'Password updated', 'success')
    } catch (err: any) {
      onToast?.(err.message || 'Failed to change password.', 'Error', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
        <KeyRound className="size-5 text-blue-500 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Change Password</h3>
          <p className="text-[11px] text-muted-foreground">Changing your password logs out every other device.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <input
          type="password"
          required
          placeholder="Current password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          disabled={hideSensitive}
          autoComplete="current-password"
          className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="password"
          required
          placeholder="New password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          disabled={hideSensitive}
          autoComplete="new-password"
          className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="password"
          required
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          disabled={hideSensitive}
          autoComplete="new-password"
          className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={busy || hideSensitive}
          className="press-scale w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
        >
          {busy ? 'Updating...' : 'Change password'}
        </button>
      </form>
    </section>
  )
}
