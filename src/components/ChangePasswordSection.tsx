import { Input } from './ui/Input'
import React, { useState } from 'react'
import { KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { CollapsibleBody } from './ui/CollapsibleBody'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast } from '../lib/mutationToast'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { getNewPasswordError } from '../lib/passwordPolicy'
import { Panel } from './ui/Panel'

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
    <Panel as="section" padding="none" className="overflow-hidden shadow-sm">
      <Button
        variant="tertiary"
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-5 text-left cursor-pointer"
      >
        <KeyRound className="size-5 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Change Password</h3>
          <p className="text-xs text-muted-foreground">Changing your password logs out every other device.</p>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
      </Button>

      <CollapsibleBody open={open}>
      <div className="px-5 pb-5 border-t border-border/40 pt-4">
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
          className="press-scale w-full rounded-xl py-2.5"
        >
          {busy ? 'Updating…' : 'Change password'}
        </Button>
      </form>
      </div>
      </CollapsibleBody>
    </Panel>
  )
}
