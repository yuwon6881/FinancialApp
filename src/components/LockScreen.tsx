import { useState } from 'react'
import * as api from '../lib/api'
import { AppLogo } from './ui/AppLogo'

interface LockScreenProps {
  isOpen: boolean
  onUnlocked: () => void
  onSignOut: () => void
}

export function LockScreen({ isOpen, onUnlocked, onSignOut }: LockScreenProps) {
  const [lockPassword, setLockPassword] = useState('')
  const [lockError, setLockError] = useState<string | null>(null)
  const [lockVerifying, setLockVerifying] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <AppLogo className="size-16 rounded-2xl shadow-xl shadow-blue-500/20" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Session Locked</h2>
          <p className="text-sm text-muted-foreground mt-1">You were inactive for 5 minutes. Please re-enter your password to continue.</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setLockVerifying(true)
            setLockError(null)
            try {
              const res = await api.verifyPassword(lockPassword)
              if (res.verified) {
                setLockPassword('')
                onUnlocked()
              } else {
                setLockError(res.message || 'Incorrect password.')
              }
            } catch {
              setLockError('Could not connect to server (backend waking up?). Please wait a moment and try again.')
            } finally {
              setLockVerifying(false)
            }
          }}
          className="w-full space-y-3"
        >
          <input
            type="password"
            required
            placeholder="Enter your password"
            value={lockPassword}
            onChange={e => setLockPassword(e.target.value)}
            autoFocus
            className="w-full px-4 py-3 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {lockError && (
            <p className="text-xs text-orange-500 font-semibold">{lockError}</p>
          )}
          <button
            type="submit"
            disabled={lockVerifying}
            className="press-scale w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer"
          >
            {lockVerifying ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
        <button
          onClick={onSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition cursor-pointer underline"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}
