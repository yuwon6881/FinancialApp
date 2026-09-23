import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.financialapp.app',
  appName: 'FinancialApp',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: false,
  },
  plugins: {
    CapacitorPasskey: {
      origin: 'https://financialapp-ecru.vercel.app',
      domains: ['financialapp-ecru.vercel.app'],
      autoShim: true,
    },
    PushNotifications: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0b0e14',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'native',
    },
  },
}

export default config
