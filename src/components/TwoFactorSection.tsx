import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ShieldCheck, ShieldOff, KeyRound, CheckCircle2 } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { RecoveryCodesModal } from './ui/RecoveryCodesModal'

interface TwoFactorSectionProps {
  hideSensitive: boolean
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
}

export const TwoFactorSection: React.FC<TwoFactorSectionProps> = ({ hideSensitive, onToast }) => {
  const [enabled, setEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Setup-in-progress state (between "start setup" and a confirmed code)
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [setupCode, setSetupCode] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)

  // One-time reveal of newly (re)generated recovery codes
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  // Disable flow
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disableBusy, setDisableBusy] = useState(false)

  const loadStatus = async () => {
    try {
      const status = await api.getTwoFactorStatus()
      setEnabled(status.enabled)
    } catch (err) {
      console.error(err)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleStartSetup = async () => {
    if (hideSensitive) return
    setSetupBusy(true)
    try {
      const { secret, otpauthUri } = await api.setupTotp()
      setSetupSecret(secret)
      setQrDataUrl(await QRCode.toDataURL(otpauthUri))
    } catch (err: any) {
      onToast?.(err.message || 'Failed to start two-factor setup.', 'Error', 'error')
    } finally {
      setSetupBusy(false)
    }
  }

  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setupCode.trim()) return
    setSetupBusy(true)
    try {
      const { recoveryCodes: codes } = await api.enableTotp(setupCode.trim())
      setEnabled(true)
      setSetupSecret(null)
      setQrDataUrl(null)
      setSetupCode('')
      setRecoveryCodes(codes)
      onToast?.('Two-factor authentication is now enabled.', 'Two-factor enabled', 'success')
    } catch (err: any) {
      onToast?.(err.message || 'Invalid code.', 'Error', 'error')
    } finally {
      setSetupBusy(false)
    }
  }

  const handleCancelSetup = () => {
    setSetupSecret(null)
    setQrDataUrl(null)
    setSetupCode('')
  }

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setDisableBusy(true)
    try {
      await api.disableTotp(disablePassword, disableCode)
      setEnabled(false)
      setShowDisableForm(false)
      setDisablePassword('')
      setDisableCode('')
      onToast?.('Two-factor authentication has been disabled.', 'Two-factor disabled', 'success')
    } catch (err: any) {
      onToast?.(err.message || 'Failed to disable two-factor authentication.', 'Error', 'error')
    } finally {
      setDisableBusy(false)
    }
  }

  const handleRegenerateRecoveryCodes = async () => {
    if (hideSensitive) return
    const password = window.prompt('Enter your password to regenerate recovery codes:')
    if (!password) return
    try {
      const { recoveryCodes: codes } = await api.regenerateRecoveryCodes(password)
      setRecoveryCodes(codes)
    } catch (err: any) {
      onToast?.(err.message || 'Failed to regenerate recovery codes.', 'Error', 'error')
    }
  }

  if (!loaded) return null

  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
        {enabled ? <ShieldCheck className="size-5 text-emerald-500 shrink-0" /> : <ShieldOff className="size-5 text-muted-foreground shrink-0" />}
        <div>
          <h3 className="text-sm font-bold text-foreground">Two-Factor Authentication</h3>
          <p className="text-[11px] text-muted-foreground">Require a code from an authenticator app (e.g. Microsoft Authenticator) at login.</p>
        </div>
      </div>

      {enabled && !showDisableForm && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold text-emerald-500">
            <CheckCircle2 className="size-3.5 shrink-0" />
            Enabled
          </div>
          <button
            type="button"
            onClick={handleRegenerateRecoveryCodes}
            disabled={hideSensitive}
            className="press-scale w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-border hover:bg-muted/50 disabled:opacity-40 transition cursor-pointer"
          >
            <KeyRound className="size-3.5" /> Regenerate recovery codes
          </button>
          <button
            type="button"
            onClick={() => setShowDisableForm(true)}
            disabled={hideSensitive}
            className="press-scale w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-40 transition cursor-pointer"
          >
            Disable two-factor authentication
          </button>
        </div>
      )}

      {enabled && showDisableForm && (
        <form onSubmit={handleDisable} className="space-y-2.5">
          <input
            type="password"
            required
            placeholder="Current password"
            value={disablePassword}
            onChange={e => setDisablePassword(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            required
            placeholder="6-digit code or recovery code"
            value={disableCode}
            onChange={e => setDisableCode(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDisableForm(false)}
              className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold border border-border hover:bg-muted/50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disableBusy}
              className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
            >
              {disableBusy ? 'Disabling...' : 'Confirm disable'}
            </button>
          </div>
        </form>
      )}

      {!enabled && !setupSecret && (
        <button
          type="button"
          onClick={handleStartSetup}
          disabled={setupBusy || hideSensitive}
          title={hideSensitive ? 'Unhide balances to edit' : undefined}
          className="press-scale w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20"
        >
          {setupBusy ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          Enable two-factor authentication
        </button>
      )}

      {!enabled && setupSecret && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Scan this QR code with Microsoft Authenticator (or any TOTP app), then enter the 6-digit code it shows.
          </p>
          {qrDataUrl && (
            <div className="flex justify-center bg-white rounded-xl p-3">
              <img src={qrDataUrl} alt="Two-factor setup QR code" className="size-40" />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground text-center">Can't scan? Enter this code manually:</p>
            <p className="text-[11px] font-mono text-center text-foreground break-all bg-muted/20 border border-border/40 rounded-lg px-2 py-1.5">{setupSecret}</p>
          </div>
          <form onSubmit={handleConfirmSetup} className="space-y-2.5">
            <input
              type="text"
              autoFocus
              required
              placeholder="123456"
              value={setupCode}
              onChange={e => setSetupCode(e.target.value)}
              className="w-full px-3.5 py-2 text-sm text-center tracking-[0.3em] bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelSetup}
                className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold border border-border hover:bg-muted/50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={setupBusy}
                className="press-scale flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
              >
                {setupBusy ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}

      <RecoveryCodesModal
        isOpen={recoveryCodes !== null}
        codes={recoveryCodes || []}
        onAcknowledge={() => setRecoveryCodes(null)}
      />
    </section>
  )
}
