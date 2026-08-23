import { Capacitor } from '@capacitor/core'

// Colors mirror the theme-color meta toggle in App.tsx, keeping native chrome
// in sync with the web PWA's light/dark surface color. These have to be literals
// -- the StatusBar plugin takes a hex string and cannot read a CSS variable -- so
// they are the one place `--background` is duplicated: keep them in step with the
// `:root` / `.dark` surfaces in index.css (and the launch color in index.html).
export const DARK_BG = '#0b0e14'
export const LIGHT_BG = '#fcfcfc'

// One-time native chrome setup. No-ops on web so the plugins never touch the
// browser build's behavior.
export async function initNativeUi(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
  await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => undefined)
  await Keyboard.setScroll({ isDisabled: false }).catch(() => undefined)
}

// Keeps the native status bar color/style aligned with the app's dark-mode toggle.
export async function syncStatusBarTheme(isDark: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const { StatusBar, Style } = await import('@capacitor/status-bar')
  await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => undefined)
  await StatusBar.setBackgroundColor({ color: isDark ? DARK_BG : LIGHT_BG }).catch(() => undefined)
}
