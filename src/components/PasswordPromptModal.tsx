import { Input } from './ui/Input'
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import * as api from '../lib/api'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { ModalActions } from './ui/ModalActions'
import { getErrorCode, getErrorMessage, getErrorName } from '../lib/errors'

function isDevicePromptCancellation(error: unknown): boolean {
  const reason = getErrorCode(error) ?? getErrorName(error)
  return reason === 'NotAllowedError' || reason === 'AbortError' || reason === 'userCancel'
}

interface PasswordPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
  /** When provided, offers device unlock as an alternative. Should return true on success. */
  onTryFingerprint?: () => Promise<boolean>
}

export function PasswordPromptModal({ isOpen, onClose, onVerified, onTryFingerprint }: PasswordPromptModalProps) {
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [promptVerifying, setPromptVerifying] = useState(false)
  const [fingerprintBusy, setFingerprintBusy] = useState(false)

  const handleClose = () => {
    onClose()
    setConfirmPassword('')
    setPasswordError(null)
    setDeviceError(null)
  }

  const handleTryFingerprint = async () => {
    if (!onTryFingerprint) return
    setDeviceError(null)
    setFingerprintBusy(true)
    try {
      const success = await onTryFingerprint()
      if (success) {
        setConfirmPassword('')
        onClose()
      } else {
        setDeviceError('Device verification failed. Try again or use your password.')
      }
    } catch (error) {
      if (!isDevicePromptCancellation(error)) {
        console.error(error)
        setDeviceError(getErrorMessage(error, 'Device verification failed. Try again or use your password.'))
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
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          if (!confirmPassword.trim()) {
            setPasswordError('Password is required.')
            focusFirstInvalidField(e.currentTarget)
            return
          }
          setPromptVerifying(true)
          setPasswordError(null)
          try {
            const res = await api.verifyPassword(confirmPassword)
            if (res.verified) {
              setConfirmPassword('')
              onVerified()
            } else {
              setPasswordError(res.message || 'Incorrect password.')
            }
          } catch (err) {
            console.error(err)
            setPasswordError('Failed to contact verification server.')
          } finally {
            setPromptVerifying(false)
          }
        }}
        className="space-y-4 font-semibold text-xs text-foreground"
      >
        <FormField label="Password" required error={passwordError}>
          <Input
            type="password"
            required
            placeholder="Enter password"
            value={confirmPassword}
            onChange={e => {
              setConfirmPassword(e.target.value)
              if (passwordError) setPasswordError(null)
            }}
            autoComplete="current-password"
            className="font-medium"
          />
        </FormField>
        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="rounded-xl px-4"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={promptVerifying || fingerprintBusy}
            className="rounded-xl px-4 shadow-md shadow-primary/10"
          >
            {promptVerifying ? 'Verifying…' : 'Verify'}
          </Button>
        </ModalActions>
      </form>

      {onTryFingerprint && (
        <div className="space-y-3 border-t border-border/40 pt-4">
          <div
            role="separator"
            aria-label="Alternative verification"
            className="flex items-center gap-3 text-eyebrow uppercase text-muted-foreground"
          >
            <span className="h-px flex-1 bg-border/60" />
            <span>Or use your device</span>
            <span className="h-px flex-1 bg-border/60" />
          </div>
          {deviceError && <p role="alert" className="text-xs leading-relaxed text-destructive">{deviceError}</p>}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleTryFingerprint}
            disabled={fingerprintBusy || promptVerifying}
            className="w-full rounded-xl"
          >
            {fingerprintBusy ? (
              <div className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {fingerprintBusy ? 'Verifying…' : 'Unlock with device'}
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}
