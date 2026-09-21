export type StorageProtection = 'checking' | 'persistent' | 'available' | 'denied' | 'unsupported'
export type UpdateResult = 'applied' | 'blocked' | 'failed' | 'unavailable'
export type InstallPromptResult = 'accepted' | 'dismissed' | 'unavailable' | 'failed'

export interface PwaExperienceValue {
  online: boolean
  installed: boolean
  installAvailable: boolean
  offlineShellReady: boolean
  offlineSetupError: string | null
  offlineSetupRetryBusy: boolean
  updateAvailable: boolean
  reloadRequired: boolean
  updateBusy: boolean
  updateMessage: string | null
  storageProtection: StorageProtection
  storageProtectionBusy: boolean
  buildId: string
  install: () => Promise<InstallPromptResult>
  retryOfflineSetup: () => Promise<void>
  applyUpdate: () => Promise<UpdateResult>
  requestStorageProtection: () => Promise<boolean>
}

const DEFAULT_VALUE: PwaExperienceValue = {
  online: true,
  installed: false,
  installAvailable: false,
  offlineShellReady: false,
  offlineSetupError: null,
  offlineSetupRetryBusy: false,
  updateAvailable: false,
  reloadRequired: false,
  updateBusy: false,
  updateMessage: null,
  storageProtection: 'checking',
  storageProtectionBusy: false,
  buildId: typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'unknown',
  install: async () => 'unavailable',
  retryOfflineSetup: async () => undefined,
  applyUpdate: async () => 'unavailable',
  requestStorageProtection: async () => false,
}

let currentValue = DEFAULT_VALUE
const listeners = new Set<() => void>()

export function getPwaExperienceValue() {
  return currentValue
}

export function subscribePwaExperience(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function publishPwaExperience(value: PwaExperienceValue) {
  currentValue = value
  for (const listener of listeners) listener()
}
