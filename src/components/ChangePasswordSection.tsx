import { Input } from './ui/Input'
import React, { useState } from 'react'
import { KeyRound } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { DisclosurePanel } from './ui/DisclosurePanel'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast } from '../lib/mutationToast'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { getNewPasswordError } from '../lib/passwordPolicy'

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (hideSensitive) return

    const newErrors: Record<string, string> = {}
    if (!currentPassword.trim()) newErrors.currentPassword = 'Current password is required.'
    const passwordError = getNewPasswordError(newPassword)
    if (passwordError) newErrors.newPassword = passwordError.replace('Password is', 'New password is')
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Confirm password is required.'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setErrors({})

    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      const copy = buildMutationSuccessToast({
        entity: 'Password',
        action: 'Updated',
        message: 'Password was updated. Other devices were logged out.',
      })
      onToast?.(copy.message, copy.title, copy.tone)
    } catch (err: unknown) {
      onToast?.(getErrorMessage(err, 'Failed to change password.'), 'Error', 'error')
    } finally {
      setBusy(false)
    }
  }

  const clearError = (key: string) => {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  return (
    <DisclosurePanel
      open={open}
      onToggle={() => setOpen(o => !o)}
      icon={<KeyRound className="text-accent-ink" />}
      title="Change Password"
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-2.5">
        <FormField label="Current password" error={errors.currentPassword} required>
          <Input
            type="password"
            value={currentPassword}
            onChange={e => { setCurrentPassword(e.target.value); clearError('currentPassword') }}
            disabled={hideSensitive}
            autoComplete="current-password"
          />
        </FormField>
        <FormField label="New password" error={errors.newPassword} required>
          <Input
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); clearError('newPassword') }}
            disabled={hideSensitive}
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Confirm new password" error={errors.confirmPassword} required>
          <Input
            type="password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); clearError('confirmPassword') }}
            disabled={hideSensitive}
            autoComplete="new-password"
          />
        </FormField>
        <Button
          type="submit"
          disabled={busy || hideSensitive || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
          className="w-full"
        >
          {busy ? 'Updating…' : 'Change password'}
        </Button>
      </form>
    </DisclosurePanel>
  )
}
