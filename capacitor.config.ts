import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'net.ogglobal.financialapp',
  appName: 'FinancialApp',
  // Vite builds the web assets here; `npx cap sync` copies them into the
  // native project.
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // We hide the splash manually once React has mounted (see main.tsx), so
      // there's never a blank/home-screen frame between the native splash and
      // the app — this is what fixes the PWA launch flash.
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0a0d14',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      // Native resize: the WebView viewport shrinks when the keyboard opens,
      // handled by the OS — smooth, and inputs stay above the keyboard with no
      // JS/CSS keyboard tracking on our side.
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // Overlays are off so content isn't drawn under the status bar; the
      // style is set dynamically per theme in App.tsx.
      overlaysWebView: false,
    },
  },
}

export default config
