import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { getWorkerActivationAction, hasUncommittedFormEdits, isStandaloneDisplayMode } from './pwaSafety'
import { publishPwaExperience, type InstallPromptResult, type PwaExperienceValue, type StorageProtection, type UpdateResult } from './pwaExperienceContext'
import { getPwaInstallPrompt, subscribePwaInstallPrompt, takePwaInstallPrompt } from './pwaInstallPrompt'

export function PwaExperienceRuntime() {
  const isNative = Capacitor.isNativePlatform()
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [installed, setInstalled] = useState(false)
  const [installAvailable, setInstallAvailable] = useState(() => getPwaInstallPrompt() !== null)
  const [offlineShellReady, setOfflineShellReady] = useState(false)
  const [offlineSetupError, setOfflineSetupError] = useState<string | null>(null)
  const [offlineSetupRetryBusy, setOfflineSetupRetryBusy] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [reloadRequired, setReloadRequired] = useState(false)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [storageProtection, setStorageProtection] = useState<StorageProtection>('checking')
  const [storageProtectionBusy, setStorageProtectionBusy] = useState(false)
  const updateServiceWorkerRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const updateRequestedRef = useRef(false)
  const updateAvailableRef = useRef(false)
  const hadControllerAtRuntimeStartRef = useRef(false)
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const registrationAttemptRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
    if (isNative) {
      setInstalled(true)
      setOfflineShellReady(true)
      setStorageProtection('unsupported')
      return () => {
        window.removeEventListener('online', syncOnline)
        window.removeEventListener('offline', syncOnline)
      }
    }
    const syncInstalled = () => {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        setInstalled(isStandaloneDisplayMode(window, navigator as Navigator & { standalone?: boolean }))
      }
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallAvailable(false)
    }
    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null
    syncInstalled()
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
    window.addEventListener('pageshow', syncInstalled)
    window.addEventListener('focus', syncInstalled)
    window.addEventListener('appinstalled', onInstalled)
    mediaQuery?.addEventListener?.('change', syncInstalled)
    return () => {
      window.removeEventListener('online', syncOnline)
      window.removeEventListener('offline', syncOnline)
      window.removeEventListener('pageshow', syncInstalled)
      window.removeEventListener('focus', syncInstalled)
      window.removeEventListener('appinstalled', onInstalled)
      mediaQuery?.removeEventListener?.('change', syncInstalled)
    }
  }, [isNative])

  useEffect(() => subscribePwaInstallPrompt(setInstallAvailable), [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (isNative) return
    let cancelled = false
    const storage = navigator.storage
    if (!storage?.persisted) {
      setStorageProtection('unsupported')
      return
    }
    void storage.persisted()
      .then(persisted => { if (!cancelled) setStorageProtection(persisted ? 'persistent' : 'available') })
      .catch(() => { if (!cancelled) setStorageProtection('unsupported') })
    return () => { cancelled = true }
  }, [isNative])

  useEffect(() => {
    if (isNative) return
    if (!('serviceWorker' in navigator)) return
    // A client that already had a controller is running an installed build. If another tab
    // activates a waiting worker, this tab must be offered a safe restart even if its own
    // Workbox instance did not deliver the earlier `waiting` event.
    hadControllerAtRuntimeStartRef.current = navigator.serviceWorker.controller !== null
    const onWorkerMessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return
      if ((event.data as { type?: unknown }).type !== 'PWA_SW_ACTIVATED') return
      const action = getWorkerActivationAction(
        updateRequestedRef.current,
        updateAvailableRef.current,
        hadControllerAtRuntimeStartRef.current,
      )
      if (action === 'reload-requesting-tab') {
        updateRequestedRef.current = false
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
        setUpdateBusy(false)
        window.location.reload()
      } else if (action === 'offer-safe-reload') {
        setReloadRequired(true)
        setUpdateMessage('The update is active. Restart this page when your current work is saved.')
      }
      // The first service-worker install also broadcasts activation, but it has no previous
      // controller and does not need a restart. Record it so later worker activations are
      // recognized as updates even in tabs that missed Workbox's `waiting` callback.
      hadControllerAtRuntimeStartRef.current = true
    }
    navigator.serviceWorker.addEventListener('message', onWorkerMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onWorkerMessage)
  }, [isNative])

  const registerOfflineSupport = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator) || registrationAttemptRef.current) return
    registrationAttemptRef.current = true
    setOfflineSetupError(null)
    try {
      const { registerSW } = await import('virtual:pwa-register')
      if (!mountedRef.current) return
      updateServiceWorkerRef.current = registerSW({
        immediate: true,
        onOfflineReady() {
          setOfflineShellReady(true)
          setOfflineSetupError(null)
        },
        onNeedRefresh() {
          updateAvailableRef.current = true
          setUpdateAvailable(true)
          setUpdateMessage(null)
        },
        onNeedReload() {
          // Workbox calls this after another client activates an update. Never reload here;
          // the user may have unsaved UI state in this tab.
          if (updateRequestedRef.current || !updateAvailableRef.current) return
          setReloadRequired(true)
          setUpdateMessage('The update is active. Restart this page when your current work is saved.')
        },
        onRegisteredSW(_url, registration) {
          setOfflineSetupError(null)
          if (registration?.active || navigator.serviceWorker.controller) {
            setOfflineShellReady(true)
          }
        },
        onRegisterError(error) {
          console.warn('Could not register the app service worker.', error)
          setOfflineSetupError('Offline support could not be set up. Check your connection and try again.')
        },
      })
      void navigator.serviceWorker.ready
        .then(() => {
          if (mountedRef.current && navigator.serviceWorker.controller) {
            setOfflineShellReady(true)
            setOfflineSetupError(null)
          }
        })
        .catch(error => {
          console.warn('Could not check offline app readiness.', error)
          if (mountedRef.current) setOfflineSetupError('Offline support could not be checked. Try again.')
        })
    } catch (error) {
      console.warn('Could not load app service-worker support.', error)
      if (mountedRef.current) setOfflineSetupError('Offline support could not be set up. Check your connection and try again.')
    } finally {
      registrationAttemptRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isNative || !import.meta.env.PROD || !('serviceWorker' in navigator)) return
    void registerOfflineSupport()
    return () => {
      updateServiceWorkerRef.current = null
    }
  }, [isNative, registerOfflineSupport])

  const retryOfflineSetup = useCallback(async (): Promise<void> => {
    if (offlineSetupRetryBusy) return
    setOfflineSetupRetryBusy(true)
    try {
      await registerOfflineSupport()
    } finally {
      if (mountedRef.current) setOfflineSetupRetryBusy(false)
    }
  }, [offlineSetupRetryBusy, registerOfflineSupport])

  const install = useCallback(async (): Promise<InstallPromptResult> => {
    const prompt = takePwaInstallPrompt()
    if (!prompt) return 'unavailable'
    setInstallAvailable(false)
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === 'accepted') return 'accepted'
      return 'dismissed'
    } catch (error) {
      console.warn('Could not show the app install prompt.', error)
      return 'failed'
    }
  }, [])

  const applyUpdate = useCallback(async (): Promise<UpdateResult> => {
    if (!updateAvailable) return 'unavailable'
    if (hasUncommittedFormEdits(document)) {
      setUpdateMessage('Save or close your current edit before restarting to update.')
      return 'blocked'
    }
    if (reloadRequired) {
      setUpdateBusy(true)
      setUpdateMessage(null)
      window.location.reload()
      return 'applied'
    }
    if (!updateServiceWorkerRef.current) return 'unavailable'
    setUpdateBusy(true)
    setUpdateMessage(null)
    try {
      updateRequestedRef.current = true
      updateTimeoutRef.current = setTimeout(() => {
        if (!updateRequestedRef.current) return
        updateRequestedRef.current = false
        setUpdateBusy(false)
        setUpdateMessage('The browser has the update but did not activate it yet. Close other app windows or try again.')
      }, 20_000)
      await updateServiceWorkerRef.current(false)
      return 'applied'
    } catch (error) {
      updateRequestedRef.current = false
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
      console.warn('Could not activate the app update.', error)
      setUpdateMessage('The update could not be applied. Your saved local work is still on this device; try again when you are online.')
      setUpdateBusy(false)
      return 'failed'
    }
  }, [reloadRequired, updateAvailable])

  const requestStorageProtection = useCallback(async (): Promise<boolean> => {
    const storage = navigator.storage
    if (!storage?.persist) {
      setStorageProtection('unsupported')
      return false
    }
    setStorageProtectionBusy(true)
    try {
      const persisted = await storage.persist()
      setStorageProtection(persisted ? 'persistent' : 'denied')
      return persisted
    } catch (error) {
      console.warn('Could not request persistent storage.', error)
      setStorageProtection('denied')
      return false
    } finally {
      setStorageProtectionBusy(false)
    }
  }, [])

  const value = useMemo<PwaExperienceValue>(() => ({
    nativeApp: isNative,
    online,
    installed,
    installAvailable,
    offlineShellReady,
    offlineSetupError,
    offlineSetupRetryBusy,
    updateAvailable,
    reloadRequired,
    updateBusy,
    updateMessage,
    storageProtection,
    storageProtectionBusy,
    buildId: typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'unknown',
    install,
    retryOfflineSetup,
    applyUpdate,
    requestStorageProtection,
  }), [
    isNative,
    online,
    installed,
    installAvailable,
    offlineShellReady,
    offlineSetupError,
    offlineSetupRetryBusy,
    updateAvailable,
    updateBusy,
    updateMessage,
    storageProtection,
    storageProtectionBusy,
    install,
    retryOfflineSetup,
    applyUpdate,
    requestStorageProtection,
  ])

  useEffect(() => publishPwaExperience(value), [value])
  return null
}
