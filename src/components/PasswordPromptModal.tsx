import { Input } from './ui/Input'
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import * as api from '../lib/api'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { ModalActions } from './ui/ModalActions'

interface PasswordPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
  /** When provided, offers device unlock as an alternative. Should return true on success. */
  onTryFingerprint?: () => Promise<boolean>
}

export function PasswordPromptModal({ isOpen, onClose, onVerified, onTryFingerprint }: PasswordPromptModalProps) {
  const [confirmPassword, setConfirmPassword] = useState('')
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptVerifying, setPromptVerifying] = useState(false)
  const [fingerprintBusy, setFingerprintBusy] = useState(false)

  const handleClose = () => {
    onClose()
    setConfirmPassword('')
    setPromptError(null)
  }

  const handleTryFingerprint = async () => {
    if (!onTryFingerprint) return
    setPromptError(null)
    setFingerprintBusy(true)
    try {
      const success = await onTryFingerprint()
      if (success) {
        setConfirmPassword('')
        onClose()
      } else {
        setPromptError('Device verification failed or was cancelled.')
      }
    } finally {
      setFingerprintBusy(false)
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-sm"
      title="Verify identity"
      description="Confirm that you are the account owner before revealing sensitive financial figures."
    >
      {onTryFingerprint && (
        <Button
          type="button"
          variant="successGhost"
          onClick={handleTryFingerprint}
          disabled={fingerprintBusy}
          className="w-full rounded-xl py-2.5"
        >
          {fingerprintBusy ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          {fingerprintBusy ? 'Verifying...' : 'Unlock with device'}
        </Button>
      )}

      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          if (!confirmPassword.trim()) {
            setPromptError('Password is required.')
            focusFirstInvalidField(e.currentTarget)
            return
          }
          setPromptVerifying(true)
          setPromptError(null)
          try {
            const res = await api.verifyPassword(confirmPassword)
            if (res.verified) {
              setConfirmPassword('')
              onVerified()
            } else {
              setPromptError(res.message || 'Incorrect password.')
            }
          } catch (err) {
            console.error(err)
            setPromptError('Failed to contact verification server.')
          } finally {
            setPromptVerifying(false)
          }
        }}
        className="space-y-4 font-semibold text-xs text-foreground"
      >
        <FormField label="Password" required error={promptError}>
          <Input
            type="password"
            required
            placeholder="Enter password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="current-password"
            className="font-medium"
          />
        </FormField>
        <ModalActions>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="rounded-xl px-4"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={promptVerifying}
            className="rounded-xl px-4 shadow-md shadow-primary/10"
          >
            {promptVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </ModalActions>
      </form>
    </BottomSheet>
  )
}
