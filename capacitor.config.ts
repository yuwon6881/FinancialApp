import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'net.ogglobal.financialapp',
  appName: 'FinancialApp',
  webDir: 'dist',
  // Matches the splash background so the WebView's own default (white) paint
  // surface can't flash through during the gap between the native splash
  // being dismissed and the app's first real frame landing.
  backgroundColor: '#0a0d14',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0a0d14',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
    },
  },
}

export default config
