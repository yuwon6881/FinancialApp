import { Input } from './ui/Input'
import React, { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { RecoveryCodesModal } from './ui/RecoveryCodesModal'
import { CollapsibleBody } from './ui/CollapsibleBody'
import { PasswordEntryModal } from './ui/PasswordEntryModal'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast } from '../lib/mutationToast'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'
import { focusFirstInvalidField } from './ui/formValidation'
import { ModalActions } from './ui/ModalActions'
import { Panel } from './ui/Panel'

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
      const [{ secret, otpauthUri }, qrCode] = await Promise.all([api.setupTotp(), import('qrcode')])
      setSetupSecret(secret)
      setQrDataUrl(await qrCode.default.toDataURL(otpauthUri))
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
      const copy = buildMutationSuccessToast({
        entity: 'Two-Factor Authentication',
        action: 'Enabled',
        message: 'Two-factor authentication was enabled.',
      })
      onToast?.(copy.message, copy.title, copy.tone)
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
      const copy = buildMutationSuccessToast({
        entity: 'Two-Factor Authentication',
        action: 'Disabled',
        message: 'Two-factor authentication was disabled.',
      })
      onToast?.(copy.message, copy.title, copy.tone)
    } catch (err: unknown) {
      setDisableErrors({ code: getErrorMessage(err, 'Failed to disable two-factor authentication.') })
    } finally {
      setDisableBusy(false)
    }
  }

  const handleRegenerateRecoveryCodes = async (password: string) => {
    try {
      const { recoveryCodes: codes } = await api.regenerateRecoveryCodes(password)
      setRecoveryCodes(codes)
    } catch (err: unknown) {
      onToast?.(getErrorMessage(err, 'Recovery codes could not be regenerated. Please try again.'), 'Regeneration failed', 'error')
      // Re-throw so the modal (PasswordEntryModal) can also handle the error state if needed
      throw err
    }
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
        {loaded && enabled ? <ShieldCheck className="size-5 text-emerald-500 shrink-0" /> : <ShieldOff className="size-5 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Two-Factor Authentication</h3>
          <p className="text-xs text-muted-foreground">Require a code from an authenticator app (e.g. Microsoft Authenticator) at login.</p>
        </div>
        <span className={`shrink-0 text-xs font-bold uppercase tracking-wider ${loaded && enabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
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
            variant="secondary"
            type="button"
            onClick={() => setShowRegenerateModal(true)}
            disabled={hideSensitive}
            className="press-scale w-full rounded-xl py-2.5"
          >
            <KeyRound className="size-3.5" /> Regenerate recovery codes
          </Button>
          <Button
            variant="destructive"
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
              variant="secondary"
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
              {disableBusy ? 'Disabling…' : 'Confirm disable'}
            </Button>
          </ModalActions>
        </form>
      )}

      {loaded && !enabled && !setupSecret && (
        <Button
          variant="primary"
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
          <p className="text-xs text-muted-foreground">
            Scan the QR code in your authenticator app, then enter its 6-digit code.
          </p>
          {qrDataUrl && (
            <div className="flex justify-center bg-white rounded-xl p-3">
              <img src={qrDataUrl} alt="Two-factor setup QR code" className="size-40" />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">Can't scan? Enter this code manually:</p>
            <p className="text-xs font-mono text-center text-foreground break-all bg-muted/20 border border-border/40 rounded-lg px-2 py-1.5">{setupSecret}</p>
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
                variant="secondary"
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
                {setupBusy ? 'Verifying…' : 'Confirm'}
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
    </Panel>
  )
}
