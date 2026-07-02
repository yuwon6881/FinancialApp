import { useState } from 'react'
import * as api from '../lib/api'
import { useDialog } from '../lib/useDialog'

interface PasswordPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
}

export function PasswordPromptModal({ isOpen, onClose, onVerified }: PasswordPromptModalProps) {
  const [confirmPassword, setConfirmPassword] = useState('')
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptVerifying, setPromptVerifying] = useState(false)

  const handleClose = () => {
    onClose()
    setConfirmPassword('')
    setPromptError(null)
  }

  const panelRef = useDialog<HTMLDivElement>(isOpen, handleClose)

  if (!isOpen) return null

  return (
    <div
      onClick={handleClose}
      className="sheet-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Verify identity"
        onClick={e => e.stopPropagation()}
        className="sheet-panel w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <h3 className="text-sm font-bold text-foreground">Verify Identity</h3>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Please enter your password to confirm you are the owner before revealing sensitive financial figures.
        </p>
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
          className="space-y-4"
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
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
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
      </div>
    </div>
  )
}
