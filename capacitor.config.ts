import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yuwon.financialapp',
  appName: 'FinancialApp',
  webDir: 'dist',
  android: {
    backgroundColor: '#f6f8fc',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0a0d14',
      androidScaleType: 'CENTER',
      showSpinner: false,
    },
  },
}

export default config