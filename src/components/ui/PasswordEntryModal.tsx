import React, { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { BottomSheet } from './BottomSheet'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Password is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(password)
      setPassword('')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-sm"
      title={
        <div className="flex items-center gap-2 text-blue-500">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <KeyRound className="size-5" />
          </span>
          <span>{title}</span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 -mt-2">
        {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
        <div className="space-y-1">
          <input
            type="password"
            autoFocus
            placeholder="Password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (error) setError(null) }}
            className={`w-full px-3.5 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
              error ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-blue-500'
            }`}
          />
          {error && (
            <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">{error}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold border border-border hover:bg-muted/50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
          >
            {busy ? 'Please wait...' : confirmText}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
