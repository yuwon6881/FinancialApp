import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, HardDrive, RefreshCw, ShieldCheck, Smartphone, Wifi, WifiOff } from 'lucide-react'
import { usePwaExperience } from '../../app/usePwaExperience'
import { getInstallInstructions } from '../../app/pwaSafety'
import { Button } from '../ui/Button'
import { panelClass } from '../ui/panelStyles'

const PENDING_SCAN_UPLOADS_CHANGED_EVENT = 'financialapp:pending-scan-uploads-changed'

interface PwaReadinessCardProps {
  unsyncedChangeCount: number
  draftCount: number
  ownerId: string
}

export const PwaReadinessCard: React.FC<PwaReadinessCardProps> = ({ unsyncedChangeCount, draftCount, ownerId }) => {
  const pwa = usePwaExperience()
  const nativeApp = pwa.nativeApp || Capacitor.isNativePlatform()
  const [message, setMessage] = useState<string | null>(null)
  const [scanImageCount, setScanImageCount] = useState<number | null | undefined>(undefined)
  const scanCountRequestRef = useRef(0)
  const refreshScanImageCount = useCallback(() => {
    const requestId = ++scanCountRequestRef.current
    if (!ownerId.trim()) {
      setScanImageCount(null)
      return
    }
    void import('../../lib/scanUploadStore').then(({ countStoredScanUploads }) => countStoredScanUploads(ownerId))
      .then(count => {
        if (scanCountRequestRef.current === requestId) setScanImageCount(count)
      })
      .catch(() => {
        if (scanCountRequestRef.current === requestId) setScanImageCount(null)
      })
  }, [ownerId])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshScanImageCount()
    }
    refreshScanImageCount()
    window.addEventListener('focus', refreshScanImageCount)
    window.addEventListener('pageshow', refreshScanImageCount)
    window.addEventListener('online', refreshScanImageCount)
    window.addEventListener(PENDING_SCAN_UPLOADS_CHANGED_EVENT, refreshScanImageCount)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      scanCountRequestRef.current++
      window.removeEventListener('focus', refreshScanImageCount)
      window.removeEventListener('pageshow', refreshScanImageCount)
      window.removeEventListener('online', refreshScanImageCount)
      window.removeEventListener(PENDING_SCAN_UPLOADS_CHANGED_EVENT, refreshScanImageCount)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshScanImageCount])

  const hasRecoverableWork = unsyncedChangeCount > 0 || draftCount > 0 || (scanImageCount ?? 0) > 0
  let syncSummary: string | null = null
  if (unsyncedChangeCount > 0) {
    syncSummary = `${unsyncedChangeCount} change${unsyncedChangeCount === 1 ? '' : 's'} waiting to sync or needing attention`
  } else if (scanImageCount === null) {
    syncSummary = 'Saved upload status could not be checked'
  } else if (scanImageCount === 0) {
    syncSummary = 'No changes waiting to sync'
  }
  const installHelp = getInstallInstructions(
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
  )

  const handleInstall = async () => {
    const result = await pwa.install()
    setMessage(result === 'accepted'
      ? 'Follow the browser prompt to finish installing FinancialApp.'
      : result === 'dismissed'
        ? 'Installation was dismissed. You can try again from this page.'
        : result === 'failed'
          ? 'The browser could not open its install prompt. Use the installation instructions below.'
          : 'Use the installation instructions below for this browser.')
  }

  const handleUpdate = async () => {
    setMessage(null)
    const result = await pwa.applyUpdate()
    if (result === 'failed') setMessage(pwa.updateMessage)
    if (result === 'blocked') setMessage(pwa.updateMessage)
  }

  const handleStorageProtection = async () => {
    const persisted = await pwa.requestStorageProtection()
    setMessage(persisted
      ? 'The browser will try to retain this app’s local storage. Keep backups for anything important.'
      : 'The browser did not grant storage protection. It may still clear local data to free space.')
  }

  return (
    <section aria-labelledby="settings-pwa-heading" className={`${panelClass} space-y-3 p-4 sm:p-5`}>
      <div className="border-b border-border/40 pb-2.5">
        <h3 id="settings-pwa-heading" className="text-subsection text-foreground">App & offline readiness</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Check this device’s install, connection, and saved work.</p>
      </div>

      <dl className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <dt className="font-medium text-foreground">App</dt>
          <dd className="ml-auto text-right text-xs text-muted-foreground">{nativeApp ? 'Native app' : pwa.installed ? 'Installed on this device' : 'Running in browser'}</dd>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {pwa.online
            ? <Wifi className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            : <WifiOff className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <dt className="font-medium text-foreground">Connection</dt>
          <dd className="ml-auto text-right text-xs text-muted-foreground">{pwa.online ? 'Online' : 'Offline'}</dd>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <HardDrive className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <dt className="font-medium text-foreground">Offline app</dt>
          <dd className="ml-auto text-right text-xs text-muted-foreground">
            {nativeApp ? 'Bundled app ready' : pwa.offlineShellReady ? 'App shell ready' : pwa.offlineSetupError ? 'Offline setup needs attention' : 'Preparing offline launch'}
          </dd>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <dt className="font-medium text-foreground">Saved work</dt>
          <dd className="ml-auto max-w-[62%] text-right text-xs text-muted-foreground">
            {syncSummary}
            {draftCount > 0 && <span className="block">{draftCount} draft{draftCount === 1 ? '' : 's'} saved on this device</span>}
            {scanImageCount === undefined && <span className="block">Checking for saved receipt or statement images</span>}
            {scanImageCount !== null && scanImageCount !== undefined && scanImageCount > 0 && (
              <span className="block">{scanImageCount} saved scan image{scanImageCount === 1 ? '' : 's'} on this device, waiting to upload or review</span>
            )}
          </dd>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="size-4 shrink-0" aria-hidden="true" />
          <dt className="font-medium text-foreground">Storage protection</dt>
          <dd className="ml-auto text-right text-xs text-muted-foreground">
            {nativeApp ? 'App storage on this device' : pwa.storageProtection === 'checking' ? 'Checking browser support'
              : pwa.storageProtection === 'persistent' ? 'Browser retention requested'
                : pwa.storageProtection === 'available' ? 'Can ask browser to retain data'
                  : pwa.storageProtection === 'denied' ? 'Browser may clear local data'
                    : 'Not reported by this browser'}
          </dd>
        </div>
      </dl>

      {!nativeApp && pwa.installAvailable && !pwa.installed && (
        <Button variant="secondary" type="button" onClick={() => void handleInstall()} className="min-h-11 w-full gap-2">
          <Download className="size-4" aria-hidden="true" /> Install FinancialApp
        </Button>
      )}

      {!nativeApp && pwa.offlineSetupError && (
        <div role="alert" className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
          <p className="text-xs leading-snug text-foreground">{pwa.offlineSetupError}</p>
          <Button
            variant="secondary"
            type="button"
            onClick={() => void pwa.retryOfflineSetup()}
            disabled={pwa.offlineSetupRetryBusy}
            className="min-h-11 w-full gap-2"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {pwa.offlineSetupRetryBusy ? 'Retrying offline setup…' : 'Retry offline setup'}
          </Button>
        </div>
      )}

      {!nativeApp && hasRecoverableWork && pwa.storageProtection === 'available' && (
        <Button
          variant="tertiary"
          type="button"
          onClick={() => void handleStorageProtection()}
          disabled={pwa.storageProtectionBusy}
          className="min-h-11 w-full gap-2"
        >
          <ShieldCheck className="size-4" aria-hidden="true" />
          {pwa.storageProtectionBusy ? 'Asking browser…' : 'Ask browser to retain saved work'}
        </Button>
      )}

      {!nativeApp && pwa.updateAvailable && (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
          <p className="text-xs leading-snug text-foreground">An app update is ready. Applying it restarts this page; saved drafts and queued changes remain on this device.</p>
          <Button variant="secondary" type="button" onClick={() => void handleUpdate()} disabled={pwa.updateBusy} className="min-h-11 w-full gap-2">
            <RefreshCw className="size-4" aria-hidden="true" />
            {pwa.updateBusy ? 'Restarting to update…' : 'Restart to update'}
          </Button>
        </div>
      )}

      {!nativeApp && <details className="group border-t border-border/30 pt-2.5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Download className="size-4" aria-hidden="true" /> Installation help
        </summary>
        <p className="pb-1 text-xs leading-relaxed text-muted-foreground">{installHelp}</p>
      </details>}

      <p className="text-right text-eyebrow text-muted-foreground">Build {pwa.buildId}</p>
      {(message || pwa.updateMessage) && (
        <p role="status" className="text-xs leading-snug text-muted-foreground">{pwa.updateMessage ?? message}</p>
      )}
      {pwa.storageProtection === 'persistent' && (
        <p className="text-xs leading-snug text-muted-foreground">{hasRecoverableWork
          ? 'Persistent storage is a best-effort browser request, not a backup.'
          : 'The browser has marked this app’s storage for retention; it can still be cleared manually.'}</p>
      )}
    </section>
  )
}
