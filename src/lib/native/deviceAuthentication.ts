import { Capacitor, registerPlugin } from '@capacitor/core'

interface NativeBiometricsPlugin {
  checkBiometry(): Promise<{ isAvailable: boolean; deviceIsSecure: boolean }>
  authenticate(options: { reason: string }): Promise<void>
}

const NativeBiometrics = registerPlugin<NativeBiometricsPlugin>('NativeBiometrics')

export async function checkNativeDeviceAuthentication(): Promise<{ isAvailable: boolean; deviceIsSecure: boolean }> {
  if (Capacitor.getPlatform() === 'ios') return NativeBiometrics.checkBiometry()
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
  return BiometricAuth.checkBiometry()
}

export async function authenticateNativeDevice(reason: string): Promise<void> {
  if (Capacitor.getPlatform() === 'ios') return NativeBiometrics.authenticate({ reason })
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
  await BiometricAuth.authenticate({
    reason,
    allowDeviceCredential: true,
    androidTitle: 'Unlock FinancialApp',
    androidSubtitle: 'Use biometrics or your device PIN.',
  })
}
