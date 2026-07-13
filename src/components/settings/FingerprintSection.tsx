import { CheckCircle2, Fingerprint, ShieldCheck, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import * as api from '../../lib/api'
import type { FingerprintCredentialSummary } from '../../lib/api'
import { getErrorMessage, getErrorName } from '../../lib/errors'
import { base64UrlToHex, createFingerprintCredential, getFriendlyDeviceLabel, isPlatformAuthenticatorAvailable } from '../../lib/webauthn'
import { useAppContext } from '../../contexts/AppContext'
import { CollapsibleBody } from '../ui/CollapsibleBody'

const DEVICE_CREDENTIAL_ID_KEY = 'fingerprint_credential_id_on_this_device'

export function FingerprintSection() {
  const { hideSensitive, showToast } = useAppContext()
  const [open, setOpen] = useState(false)
  const [credentials, setCredentials] = useState<FingerprintCredentialSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState(false)
  const load = async () => setCredentials(await api.listFingerprintCredentials())
  useEffect(() => {
    void load().catch(console.error)
    void isPlatformAuthenticatorAvailable().then(setAvailable)
  }, [])
  const enrolledHere = useMemo(() => {
    const stored = localStorage.getItem(DEVICE_CREDENTIAL_ID_KEY)
    if (!stored || credentials.length === 0) return false
    if (stored === 'already_enrolled') return true
    let legacyHex: string | null = null
    try { legacyHex = base64UrlToHex(stored) } catch { /* Legacy value was not base64url. */ }
    return credentials.some(credential => credential.id.toUpperCase() === stored.toUpperCase() || credential.id.toUpperCase() === legacyHex)
  }, [credentials])

  const enroll = async () => {
    if (hideSensitive) return
    setBusy(true)
    try {
      const { challengeId, options } = await api.getFingerprintRegisterOptions()
      const credential = await createFingerprintCredential(options)
      await api.verifyFingerprintRegistration(challengeId, credential, getFriendlyDeviceLabel())
      localStorage.setItem(DEVICE_CREDENTIAL_ID_KEY, base64UrlToHex(credential.id))
      await load()
      showToast('Fingerprint enabled on this device.', 'Fingerprint enabled', 'success')
    } catch (error) {
      if (getErrorName(error) === 'InvalidStateError') {
        localStorage.setItem(DEVICE_CREDENTIAL_ID_KEY, 'already_enrolled')
        await load()
        showToast('This device already has fingerprint enabled.', 'Already enabled', 'info')
      } else if (getErrorName(error) !== 'NotAllowedError') {
        showToast(getErrorMessage(error, 'Failed to register fingerprint on this device.'), 'Fingerprint error', 'error')
      }
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id: string) => {
    if (hideSensitive) return
    try {
      await api.deleteFingerprintCredential(id)
      await load()
      showToast('Fingerprint credential removed.', 'Fingerprint removed', 'success')
    } catch (error) {
      showToast(getErrorMessage(error, 'Failed to remove fingerprint credential.'), 'Fingerprint error', 'error')
    }
  }

  if (!available) return null
  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 shadow-sm overflow-hidden animate-in fade-in duration-200">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-5 text-left cursor-pointer"
      >
        <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Fingerprint Login</h3>
          <p className="text-[11px] text-muted-foreground">Unlock with this device's fingerprint or face unlock.</p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${enrolledHere ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {enrolledHere ? 'Enabled' : 'Disabled'}
        </span>
        {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
      </button>

      <CollapsibleBody open={open}>
        <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4">
          {credentials.map(credential => (
            <div key={credential.id} className="flex items-center justify-between bg-muted/20 border px-3 py-2.5 rounded-xl text-xs">
              <span className="flex items-center gap-2 font-semibold">
                <Fingerprint className="size-4 text-emerald-500" />
                {credential.deviceLabel || 'Registered device'}
              </span>
              <button type="button" onClick={() => void remove(credential.id)} disabled={hideSensitive} className="p-1.5 text-muted-foreground hover:text-orange-500 disabled:opacity-40">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {enrolledHere ? (
            <div className="flex justify-center gap-1.5 text-[11px] font-semibold text-emerald-500">
              <CheckCircle2 className="size-3.5" /> Enabled on this device
            </div>
          ) : (
            <button type="button" onClick={() => void enroll()} disabled={busy || hideSensitive} className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 disabled:opacity-50 text-white">
              {busy ? <span className="size-3.5 rounded-full border-2 border-t-transparent animate-spin" /> : <Fingerprint className="size-3.5" />}
              {credentials.length ? 'Add another device' : 'Enable on this device'}
            </button>
          )}
        </div>
      </CollapsibleBody>
    </section>
  )
}
