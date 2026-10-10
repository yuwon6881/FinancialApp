import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import * as api from '../../lib/api'
import type { FingerprintCredentialSummary } from '../../lib/api'
import { getErrorMessage, getErrorName } from '../../lib/errors'
import { buildMutationSuccessToast } from '../../lib/mutationToast'
import {
  createFingerprintCredential,
  getFingerprintAssertion,
  getFriendlyDeviceLabel,
  isPlatformAuthenticatorAvailable,
} from '../../lib/webauthn'
import {
  forgetDeviceUnlockCredential,
  getDeviceUnlockRegistrationMarker,
  rememberDeviceUnlockCredential,
} from '../../lib/deviceUnlockRegistration'
import { useAppPrefs, useAppUi } from '../../contexts/AppContext'
import { DisclosurePanel } from '../ui/DisclosurePanel'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { MutationButtonContent, MutationStatusAnnouncement } from '../ui/MutationButtonContent'

export function FingerprintSection() {
  const { hideSensitive } = useAppPrefs()
  const { showToast } = useAppUi()
  const [open, setOpen] = useState(false)
  const [credentials, setCredentials] = useState<FingerprintCredentialSummary[]>([])
  const [credentialsLoaded, setCredentialsLoaded] = useState(false)
  const [credentialsError, setCredentialsError] = useState('')
  const [busy, setBusy] = useState(false)
  const [removingCredentialId, setRemovingCredentialId] = useState<string | null>(null)
  const [capability, setCapability] = useState<'checking' | 'supported' | 'unsupported'>('checking')
  const enrollmentAbortRef = useRef<AbortController | null>(null)
  const username = localStorage.getItem('auth_username') || ''
  const load = async () => {
    setCredentialsLoaded(false)
    setCredentialsError('')
    try {
      setCredentials(await api.listFingerprintCredentials())
    } catch (error) {
      setCredentialsError(getErrorMessage(error, 'Could not load registered credentials.'))
    } finally {
      setCredentialsLoaded(true)
    }
  }
  useEffect(() => {
    void load()
    // A credential-creation call is not a silent capability probe: browsers show their native
    // passkey prompt before the promise can be cancelled. Only the explicit setup action below
    // may invoke WebAuthn creation.
    void isPlatformAuthenticatorAvailable()
      .then(available => setCapability(available ? 'supported' : 'unsupported'))
      .catch(() => setCapability('unsupported'))
  }, [])

  useEffect(() => () => {
    enrollmentAbortRef.current?.abort()
    enrollmentAbortRef.current = null
  }, [])

  const enrolledHere = useMemo(() => {
    const stored = getDeviceUnlockRegistrationMarker(username)
    if (!stored || credentials.length === 0) return false
    return credentials.some(credential => credential.id.toUpperCase() === stored)
  }, [credentials, username])

  const enabledOnAccount = credentials.length > 0
  // The account owns a credential but this browser cannot name one. Usually site data was
  // cleared: the credential and its server row both survive that, only the local marker does
  // not. If creation reports a duplicate, the setup action proves the holder with an assertion.
  const needsLocalSetup = enabledOnAccount && !enrolledHere && capability === 'supported'
  const status = !credentialsLoaded
    ? { label: 'Checking', className: 'text-muted-foreground' }
    : credentialsError
      ? { label: 'Unavailable', className: 'text-destructive' }
    : enrolledHere
      ? { label: 'Enabled here', className: 'text-emerald-600 dark:text-emerald-400' }
      : enabledOnAccount
        ? { label: 'Available', className: 'text-accent-ink' }
        : { label: 'Not enabled', className: 'text-muted-foreground' }

  const enroll = async () => {
    if (hideSensitive || capability !== 'supported') return
    enrollmentAbortRef.current?.abort()
    const abortController = new AbortController()
    enrollmentAbortRef.current = abortController
    setBusy(true)
    try {
      const { challengeId, options } = await api.getFingerprintRegisterOptions()
      const credential = await createFingerprintCredential(options, abortController.signal)
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
        if (abortController.signal.aborted) return
        try {
          const registeredCredentials = await api.listFingerprintCredentials()
          setCredentials(registeredCredentials)
          if (registeredCredentials.length === 0) {
            showToast(
              'A FinancialApp passkey already exists on this phone, but this account has no registered device credential. Remove the old passkey from the phone password manager, then try again.',
              'Device unlock needs reset',
              'error',
            )
            return
          }
          const { challengeId, options } = await api.getFingerprintAssertOptions()
          const existing = await getFingerprintAssertion(options, abortController.signal)
          if (existing.authenticatorAttachment !== 'platform') {
            throw new Error('This passkey belongs to another device. Use this phone’s own screen lock or add a credential here.', { cause: error })
          }
          await api.verifyFingerprintAssert(challengeId, existing)
          rememberDeviceUnlockCredential(username, existing.id)
          await load()
          const copy = buildMutationSuccessToast({
            entity: 'Device Unlock',
            action: 'Enabled',
            message: 'Device unlock was enabled on this device.',
          })
          showToast(copy.message, copy.title, copy.tone)
        } catch (assertError) {
          if (getErrorName(assertError) === 'NotAllowedError' || getErrorName(assertError) === 'AbortError') {
            showToast('Confirm with this phone’s fingerprint, face recognition, PIN, or screen lock to finish setup.', 'Device unlock needs confirmation', 'info')
          } else {
            showToast(getErrorMessage(assertError, 'Could not verify the existing device credential.'), 'Device unlock error', 'error')
          }
        }
      } else if (getErrorName(error) === 'NotAllowedError' && Capacitor.isNativePlatform()) {
        showToast(
          'Android could not create a passkey. Check that this phone has a screen lock and this app is verified for sign-in, then try again.',
          'Device unlock was not enabled',
          'error',
        )
      } else if (getErrorName(error) !== 'NotAllowedError') {
        showToast(getErrorMessage(error, 'Failed to set up device unlock on this device.'), 'Device unlock error', 'error')
      }
    } finally {
      if (enrollmentAbortRef.current === abortController) enrollmentAbortRef.current = null
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

  return (
    <DisclosurePanel
      open={open}
      onToggle={() => setOpen(o => !o)}
      icon={<ShieldCheck className="text-emerald-500" />}
      title="Device Unlock"
      status={<span className={status.className}>{status.label}</span>}
    >
      <div className="@container rounded-control bg-surface-2/70 p-4">
        <div className="flex flex-col gap-4 @md:flex-row @md:items-center @md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-accent-ink">
              <KeyRound className="size-3.5" />
            </span>
            <span className="text-label text-foreground">Device Authentication</span>
          </div>
          {needsLocalSetup && !enrolledHere && (
            <p className="mt-2 text-caption text-muted-foreground">
              Confirm with your fingerprint, face, PIN, or screen lock to use this account’s device credential here.
            </p>
          )}
          {capability === 'checking' && (
            <p className="mt-2 text-caption text-muted-foreground">Checking whether this device can add a credential…</p>
          )}
          {capability === 'unsupported' && (
            <p className="mt-2 text-caption text-muted-foreground">This device cannot add a local biometric or screen-lock credential. You can still manage credentials already registered to the account.</p>
          )}
        </div>
        <div className="flex w-full shrink-0 @md:w-auto">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || hideSensitive || capability !== 'supported'}
            onClick={enroll}
            className="w-full shrink-0 @md:w-auto"
          >
            <MutationButtonContent
              state={busy ? 'saving' : null}
              entityLabel="device credential"
              idleLabel={enrolledHere ? 'Add another credential' : enabledOnAccount ? 'Set up this device' : 'Enable on this device'}
              busyLabel="Setting up…"
              idleIcon={<ShieldCheck className="size-3.5" />}
            />
          </Button>
        </div>
        </div>
      </div>

      {credentialsError && (
        <div role="alert" className="flex flex-col gap-2 rounded-control bg-destructive/8 px-4 py-3 text-caption text-red-600 dark:text-red-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{credentialsError}</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={!credentialsLoaded}>
            Retry
          </Button>
        </div>
      )}

      {credentials.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-label text-muted-foreground">
            Registered credentials ({credentials.length})
          </h4>
          <div className="space-y-1.5">
            {credentials.map(c => {
              const isRemoving = removingCredentialId === c.id
              const isCurrent = getDeviceUnlockRegistrationMarker(username) === c.id.toUpperCase()
              return (
                <div
                  key={c.id}
                  aria-busy={isRemoving}
                  className="flex items-center justify-between gap-3 rounded-control bg-surface-2/70 py-2 pl-4 pr-2 text-caption"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isCurrent ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <KeyRound className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5 truncate text-label text-foreground">
                        <span>{c.deviceLabel || 'Unnamed credential'}</span>
                        {isCurrent && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-micro text-emerald-700 dark:text-emerald-300">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-caption text-muted-foreground">
                        <span>Added {new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconButton
                      type="button"
                      disabled={busy || removingCredentialId !== null || hideSensitive}
                      onClick={() => remove(c.id)}
                      className="size-11 shrink-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 sm:size-9"
                      tooltip={`Remove ${c.deviceLabel || 'credential'}`}
                      label={`Remove ${c.deviceLabel || 'credential'}`}
                      aria-busy={isRemoving}
                    >
                      {isRemoving ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      <MutationStatusAnnouncement state={isRemoving ? 'deleting' : null} entityLabel={c.deviceLabel || 'credential'} />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </DisclosurePanel>
  )
}
