import { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import * as api from '../lib/api'
import { BottomSheet } from './ui/BottomSheet'

interface PasswordPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
  /** When provided, shows a "Try Fingerprint Instead" button. Should return true on success. */
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
        setPromptError('Fingerprint verification failed or was cancelled.')
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
      title="Verify Identity"
    >
      <p className="text-xs text-muted-foreground">
        Please enter your password to confirm you are the owner before revealing sensitive financial figures.
      </p>

      {onTryFingerprint && (
        <button
          type="button"
          onClick={handleTryFingerprint}
          disabled={fingerprintBusy}
          className="press-scale w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-500 border border-emerald-500/30 font-bold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          {fingerprintBusy ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <Fingerprint className="size-3.5" />
          )}
          {fingerprintBusy ? 'Verifying...' : 'Unlock with Fingerprint'}
        </button>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault()
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
        <div className="space-y-1">
          <input
            type="password"
            required
            placeholder="Enter password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            readOnly
            onFocus={(e) => e.target.removeAttribute('readonly')}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          />
          {promptError && (
            <p className="text-[10px] text-orange-500 font-semibold mt-1">
              {promptError}
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-xl cursor-pointer transition duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={promptVerifying}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer transition duration-150 shadow-md shadow-blue-600/10"
          >
            {promptVerifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
