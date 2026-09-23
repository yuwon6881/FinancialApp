import { registerPlugin } from '@capacitor/core'

interface NativeBiometricsPlugin {
  checkBiometry(): Promise<{ isAvailable: boolean; deviceIsSecure: boolean }>
  authenticate(options: { reason: string }): Promise<void>
  setHidden(options: { hidden: boolean }): Promise<void>
}

// Capacitor keeps plugin registrations in a global registry, so every native
// surface must share this one registration for the iOS security plugin.
export const NativeBiometrics = registerPlugin<NativeBiometricsPlugin>('NativeBiometrics')
