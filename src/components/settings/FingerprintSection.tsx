import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import * as api from '../../lib/api'
import type { FingerprintCredentialSummary } from '../../lib/api'
import { getErrorMessage, getErrorName } from '../../lib/errors'
import { buildMutationSuccessToast } from '../../lib/mutationToast'
import { createFingerprintCredential, getFriendlyDeviceLabel, isPlatformAuthenticatorAvailable } from '../../lib/webauthn'
import {
  forgetDeviceUnlockCredential,
  getDeviceUnlockRegistrationMarker,
  rememberDeviceUnlockCredential,
  rememberExistingDeviceUnlock,
} from '../../lib/deviceUnlockRegistration'
import { useAppPrefs, useAppUi } from '../../contexts/AppContext'
import { CollapsibleBody } from '../ui/CollapsibleBody'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'

export function FingerprintSection() {
  const { hideSensitive } = useAppPrefs()
  const { showToast } = useAppUi()
  const [open, setOpen] = useState(false)
  const [credentials, setCredentials] = useState<FingerprintCredentialSummary[]>([])
  const [credentialsLoaded, setCredentialsLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removingCredentialId, setRemovingCredentialId] = useState<string | null>(null)
  const [available, setAvailable] = useState(false)
  const username = localStorage.getItem('auth_username') || ''
  const load = async () => {
    try {
      setCredentials(await api.listFingerprintCredentials())
    } finally {
      setCredentialsLoaded(true)
    }
  }
  useEffect(() => {
    void load().catch(console.error)
    // A credential-creation call is not a silent capability probe: browsers show their native
    // passkey prompt before the promise can be cancelled. Only the explicit setup action below
    // may invoke WebAuthn creation.
    void isPlatformAuthenticatorAvailable().then(setAvailable)
  }, [])

  const enrolledHere = useMemo(() => {
    const stored = getDeviceUnlockRegistrationMarker(username)
    if (!stored || credentials.length === 0) return false
    if (stored === 'already_enrolled') return true
    return credentials.some(credential => credential.id.toUpperCase() === stored)
  }, [credentials, username])

  const enabledOnAccount = credentials.length > 0
  const status = !credentialsLoaded
    ? { label: 'Checking', className: 'text-muted-foreground' }
    : enrolledHere
      ? { label: 'Enabled here', className: 'text-emerald-500' }
      : enabledOnAccount
        ? { label: 'Available', className: 'text-blue-500' }
        : { label: 'Not enabled', className: 'text-muted-foreground' }

  const enroll = async () => {
    if (hideSensitive) return
    setBusy(true)
    try {
      const { challengeId, options } = await api.getFingerprintRegisterOptions()
      const credential = await createFingerprintCredential(options)
      await api.verifyFingerprintRegistration(challengeId, credential, getFriendlyDeviceLabel())
      rememberDeviceUnlockCredential(username, credential.id)
      await load()
      const copy = buildMutationSuccessToast({
        entity: 'Device Unlock',
        action: 'Enabled',
        message: 'Device unlock was enabled on this device.',
      })
      showToast(copy.message, copy.title, copy.tone)
    } catch (error) {
      if (getErrorName(error) === 'InvalidStateError') {
        rememberExistingDeviceUnlock(username)
        await load()
        showToast('This device already has device unlock enabled.', 'Already enabled', 'info')
      } else if (getErrorName(error) !== 'NotAllowedError') {
        showToast(getErrorMessage(error, 'Failed to set up device unlock on this device.'), 'Device unlock error', 'error')
      }
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id: string) => {
    if (hideSensitive || busy || removingCredentialId !== null) return
    setRemovingCredentialId(id)
    try {
      await api.deleteFingerprintCredential(id)
      forgetDeviceUnlockCredential(username, id)
      await load()
      const copy = buildMutationSuccessToast({
        entity: 'Device Unlock Credential',
        action: 'Removed',
        message: 'Device unlock credential was removed.',
      })
      showToast(copy.message, copy.title, copy.tone)
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to remove device unlock credential.'), 'Device unlock error', 'error')
    } finally {
      setRemovingCredentialId(null)
    }
  }

  if (!available) return null
  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 shadow-sm overflow-hidden animate-in fade-in duration-200">
      <Button variant="unstyled"
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-5 text-left cursor-pointer"
      >
        <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Device Unlock</h3>
          <p className="text-[11px] text-muted-foreground">
            {enrolledHere
              ? "Use this device's screen lock, PIN, fingerprint, or face recognition."
              : enabledOnAccount
                ? 'Enabled for this account; set up this device to use it here.'
                : "Use this device's screen lock, PIN, fingerprint, or face recognition."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
          {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
        </div>
      </Button>

      <CollapsibleBody open={open}>
        <div className="px-5 pb-5 pt-0 space-y-4 border-t border-border/40">
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-muted-foreground" />
                <span>Device Authentication</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {enrolledHere
                  ? 'This device can unlock your account using biometrics or screen lock.'
                  : 'Register this device to allow fast biometric or PIN unlock on the login screen.'}
              </p>
            </div>
            <Button
              type="button"
              variant={enrolledHere ? 'outline' : 'primary'}
              size="sm"
              disabled={busy || hideSensitive}
              onClick={enroll}
              className="shrink-0"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Setting up…</span>
                </>
              ) : enrolledHere ? (
                <span>Add another credential</span>
              ) : enabledOnAccount ? (
                <span>Set up this device</span>
              ) : (
                <span>Enable on this device</span>
              )}
            </Button>
          </div>

          {credentials.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Registered Credentials ({credentials.length})
              </span>
              <div className="space-y-1.5">
                {credentials.map(c => {
                  const isRemoving = removingCredentialId === c.id
                  const isCurrent = getDeviceUnlockRegistrationMarker(username) === c.id.toUpperCase()
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-background/50 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isCurrent ? (
                          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        ) : (
                          <KeyRound className="size-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                            <span>{c.deviceLabel || 'Unnamed credential'}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-semibold px-1.5 py-0.5 rounded-full">
                                This device
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Added {new Date(c.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy || removingCredentialId !== null || hideSensitive}
                        onClick={() => remove(c.id)}
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={`Remove ${c.deviceLabel || 'credential'}`}
                        aria-label={`Remove ${c.deviceLabel || 'credential'}`}
                      >
                        {isRemoving ? (
                          <RowSyncStatus isDeleting entityLabel="Credential" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleBody>
    </section>
  )
}
