import { Input } from './ui/Input'
import React, { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, KeyRound } from 'lucide-react'
import * as api from '../lib/api'
import type { ToastTone } from './ui/ToastViewport'
import { RecoveryCodesModal } from './ui/RecoveryCodesModal'
import { DisclosurePanel } from './ui/DisclosurePanel'
import { PasswordEntryModal } from './ui/PasswordEntryModal'
import { getErrorMessage } from '../lib/errors'
import { buildMutationSuccessToast } from '../lib/mutationToast'
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
    <>
    <DisclosurePanel
      open={open}
      onToggle={() => setOpen(o => !o)}
      icon={loaded && enabled ? <ShieldCheck className="text-emerald-500" /> : <ShieldOff className="text-muted-foreground" />}
      title="Two-Factor Authentication"
      status={(
        <span className={loaded && enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
          {loaded ? (enabled ? 'Enabled' : 'Disabled') : 'Checking…'}
        </span>
      )}
    >
      {!loaded && (
        <p className="text-caption text-muted-foreground animate-pulse">Checking two-factor status…</p>
      )}

      {loaded && enabled && !showDisableForm && (
        <div className="space-y-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setShowRegenerateModal(true)}
            disabled={hideSensitive}
            className="w-full"
          >
            <KeyRound className="size-3.5" /> Regenerate recovery codes
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={() => setShowDisableForm(true)}
            disabled={hideSensitive}
            className="w-full"
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
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="submit"
              disabled={disableBusy}
              aria-busy={disableBusy}
              className="flex-1"
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
          className="w-full"
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
            <p className="text-xs font-mono text-center text-foreground break-all rounded-control bg-surface-2/70 px-3 py-2">{setupSecret}</p>
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
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={setupBusy}
                aria-busy={setupBusy}
                className="flex-1"
              >
                {setupBusy ? 'Verifying…' : 'Confirm'}
              </Button>
            </ModalActions>
          </form>
        </div>
      )}

    </DisclosurePanel>

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
    </>
  )
}
