import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

// One-time native chrome setup. No-ops on web so the plugins never touch the
// browser build's behavior.
export async function initNativeUi(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  await syncSystemBarsTheme(document.documentElement.classList.contains('dark'))

  const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
  await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => undefined)
  await Keyboard.setScroll({ isDisabled: false }).catch(() => undefined)
}

// Android 15+ requires edge-to-edge system bars, so the native bridge keeps the
// transparent status/navigation bar icon contrast aligned with the app theme.
export async function syncSystemBarsTheme(isDark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  await SystemBars.setStyle({
    style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  }).catch(() => undefined)
}
