import { Capacitor } from '@capacitor/core'

/** True when running inside the Capacitor native shell (Android/iOS app). */
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform()

/**
 * Match the native status bar to the active theme. Style.Dark = light icons
 * (for our obsidian dark bg); Style.Light = dark icons (for the light bg).
 */
export async function applyStatusBarTheme(dark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: dark ? '#0a0d14' : '#f6f8fc' })
    }
  } catch {
    /* plugin unavailable — ignore */
  }
}

/**
 * Dismiss the native splash screen. Called once React has painted so there's
 * no blank frame between the splash and the app (the launch-flash fix).
 */
export async function hideSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* plugin unavailable — ignore */
  }
}
