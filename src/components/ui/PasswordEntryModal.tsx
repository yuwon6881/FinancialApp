import { Input } from './Input'
import React, { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { getErrorMessage } from '../../lib/errors'
import { Button } from './Button'
import { FormField } from './FormField'
import { focusFirstInvalidField } from './formValidation'
import { ModalActions } from './ModalActions'

interface PasswordEntryModalProps {
  isOpen: boolean
  title: string
  description?: string
  confirmText?: string
  onClose: () => void
  onSubmit: (password: string) => Promise<void>
}

// Themed replacement for window.prompt() when a flow just needs the account password
// re-entered to authorize a sensitive action (e.g. regenerating recovery codes).
export const PasswordEntryModal: React.FC<PasswordEntryModalProps> = ({
  isOpen, title, description, confirmText = 'Confirm', onClose, onSubmit
}) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleClose = () => {
    setPassword('')
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Password is required.')
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(password)
      setPassword('')
      onClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-sm"
      description={description}
      title={
        <div className="flex items-center gap-2 text-blue-500">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <KeyRound className="size-5" />
          </span>
          <span>{title}</span>
        </div>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-3 -mt-2">
        <FormField label="Password" required error={error}>
          <Input
            type="password"
            autoFocus
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (error) setError(null) }}
          />
        </FormField>
        <ModalActions>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="rounded-xl"
          >
            {busy ? 'Please wait...' : confirmText}
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
  )
}
