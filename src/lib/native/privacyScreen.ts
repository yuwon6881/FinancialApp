import { Capacitor, registerPlugin } from '@capacitor/core'

interface PrivacyScreenPlugin {
  setHidden(options: { hidden: boolean }): Promise<void>
}

const PrivacyScreen = registerPlugin<PrivacyScreenPlugin>('PrivacyScreen')
const NativeSecurity = registerPlugin<PrivacyScreenPlugin>('NativeBiometrics')

/** Keeps native task snapshots private until the local app-access gate has opened. */
export async function setNativeFinancialContentHidden(hidden: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const plugin = Capacitor.getPlatform() === 'ios' ? NativeSecurity : PrivacyScreen
  await plugin.setHidden({ hidden })
}
