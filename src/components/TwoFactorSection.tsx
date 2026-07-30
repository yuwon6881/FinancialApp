import { Input } from './ui/Input'
import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ShieldCheck, ShieldOff, KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { RecoveryCodesModal } from './ui/RecoveryCodesModal'
import { CollapsibleBody } from './ui/CollapsibleBody'
import { PasswordEntryModal } from './ui/PasswordEntryModal'
import { getErrorMessage } from '../lib/errors'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { ModalActions } from './ui/ModalActions'

interface TwoFactorSectionProps {
  hideSensitive: boolean
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
}

export const TwoFactorSection: React.FC<TwoFactorSectionProps> = ({ hideSensitive, onToast }) => {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Setup-in-progress state (between "start setup" and a confirmed code)
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [setupCode, setSetupCode] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  // One-time reveal of newly (re)generated recovery codes
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)

  // Disable flow
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disableBusy, setDisableBusy] = useState(false)
  const [disableErrors, setDisableErrors] = useState<Record<string, string>>({})

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
    } catch (err: unknown) {
      onToast?.(getErrorMessage(err, 'Failed to start two-factor setup.'), 'Error', 'error')
    } finally {
      setSetupBusy(false)
    }
  }

  const handleConfirmSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!setupCode.trim()) {
      setSetupError('Verification code is required.')
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setSetupError(null)
    setSetupBusy(true)
    try {
      const { recoveryCodes: codes } = await api.enableTotp(setupCode.trim())
      setEnabled(true)
      setSetupSecret(null)
      setQrDataUrl(null)
      setSetupCode('')
      setRecoveryCodes(codes)
      onToast?.('Two-factor authentication is now enabled.', 'Two-factor enabled', 'success')
    } catch (err: unknown) {
      setSetupError(getErrorMessage(err, 'Invalid code.'))
    } finally {
      setSetupBusy(false)
    }
  }

  const handleCancelSetup = () => {
    setSetupSecret(null)
    setQrDataUrl(null)
    setSetupCode('')
    setSetupError(null)
  }

  const handleDisable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!disablePassword.trim()) newErrors.password = 'Password is required.'
    if (!disableCode.trim()) newErrors.code = 'Verification code is required.'
    if (Object.keys(newErrors).length > 0) {
      setDisableErrors(newErrors)
      focusFirstInvalidField(e.currentTarget)
      return
    }
    setDisableErrors({})
    setDisableBusy(true)
    try {
      await api.disableTotp(disablePassword, disableCode)
      setEnabled(false)
      setShowDisableForm(false)
      setDisablePassword('')
      setDisableCode('')
      onToast?.('Two-factor authentication has been disabled.', 'Two-factor disabled', 'success')
    } catch (err: unknown) {
      setDisableErrors({ code: getErrorMessage(err, 'Failed to disable two-factor authentication.') })
    } finally {
      setDisableBusy(false)
    }
  }

  const handleRegenerateRecoveryCodes = async (password: string) => {
    const { recoveryCodes: codes } = await api.regenerateRecoveryCodes(password)
    setRecoveryCodes(codes)
  }

  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 shadow-sm overflow-hidden">
      <Button
        variant="unstyled"
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-5 text-left cursor-pointer"
      >
        {loaded && enabled ? <ShieldCheck className="size-5 text-emerald-500 shrink-0" /> : <ShieldOff className="size-5 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Two-Factor Authentication</h3>
          <p className="text-[11px] text-muted-foreground">Require a code from an authenticator app (e.g. Microsoft Authenticator) at login.</p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${loaded && enabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {loaded ? (enabled ? 'Enabled' : 'Disabled') : 'Checking…'}
        </span>
        {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
      </Button>

      <CollapsibleBody open={open}>
      <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4">

      {!loaded && (
        <p className="text-xs text-muted-foreground animate-pulse">Checking two-factor status…</p>
      )}

      {loaded && enabled && !showDisableForm && (
        <div className="space-y-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => setShowRegenerateModal(true)}
            disabled={hideSensitive}
            className="press-scale w-full rounded-xl py-2.5"
          >
            <KeyRound className="size-3.5" /> Regenerate recovery codes
          </Button>
          <Button
            variant="destructiveGhost"
            type="button"
            onClick={() => setShowDisableForm(true)}
            disabled={hideSensitive}
            className="press-scale w-full rounded-xl py-2.5"
          >
            Disable two-factor authentication
          </Button>
        </div>
      )}

      {loaded && enabled && showDisableForm && (
        <form noValidate onSubmit={handleDisable} className="space-y-2.5">
          <FormField label="Current password" required error={disableErrors.password}>
            <Input
              type="password"
              value={disablePassword}
              onChange={e => { setDisablePassword(e.target.value); if (disableErrors.password) setDisableErrors(prev => ({ ...prev, password: '' })) }}
              autoComplete="current-password"
            />
          </FormField>
          <FormField label="Verification or recovery code" required error={disableErrors.code}>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={disableCode}
              onChange={e => { setDisableCode(e.target.value); if (disableErrors.code) setDisableErrors(prev => ({ ...prev, code: '' })) }}
            />
          </FormField>
          <ModalActions>
            <Button
              variant="outline"
              type="button"
              onClick={() => { setShowDisableForm(false); setDisableErrors({}) }}
              className="press-scale flex-1 rounded-xl py-2.5"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="submit"
              disabled={disableBusy}
              aria-busy={disableBusy}
              className="press-scale flex-1 rounded-xl py-2.5"
            >
              {disableBusy ? 'Disabling...' : 'Confirm disable'}
            </Button>
          </ModalActions>
        </form>
      )}

      {loaded && !enabled && !setupSecret && (
        <Button
          variant="success"
          type="button"
          onClick={handleStartSetup}
          disabled={setupBusy || hideSensitive}
          title={hideSensitive ? 'Unhide balances to edit' : undefined}
          aria-busy={setupBusy}
          className="press-scale w-full rounded-xl py-2.5 shadow-md shadow-emerald-600/20"
        >
          {setupBusy ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          Enable two-factor authentication
        </Button>
      )}

      {loaded && !enabled && setupSecret && (
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
          <form noValidate onSubmit={handleConfirmSetup} className="space-y-2.5">
            <FormField
              label="Authenticator verification code"
              required
              error={setupError}
              errorClassName="text-center"
            >
              <Input
                type="text"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                value={setupCode}
                onChange={e => { setSetupCode(e.target.value); if (setupError) setSetupError(null) }}
                className="text-center tracking-[0.3em]"
              />
            </FormField>
            <ModalActions>
              <Button
                variant="outline"
                type="button"
                onClick={handleCancelSetup}
                className="press-scale flex-1 rounded-xl py-2.5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={setupBusy}
                aria-busy={setupBusy}
                className="press-scale flex-1 rounded-xl py-2.5"
              >
                {setupBusy ? 'Verifying...' : 'Confirm'}
              </Button>
            </ModalActions>
          </form>
        </div>
      )}

      </div>
      </CollapsibleBody>

      <RecoveryCodesModal
        isOpen={recoveryCodes !== null}
        codes={recoveryCodes || []}
        onAcknowledge={() => setRecoveryCodes(null)}
      />

      <PasswordEntryModal
        isOpen={showRegenerateModal}
        title="Regenerate recovery codes"
        description="Your existing recovery codes will stop working. Enter your password to generate a new set."
        confirmText="Regenerate"
        onClose={() => setShowRegenerateModal(false)}
        onSubmit={handleRegenerateRecoveryCodes}
      />
    </section>
  )
}
