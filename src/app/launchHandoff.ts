import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const wait = (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds))

const waitForStableAppPaint = async () => {
  await nextPaint()
  await nextPaint()
  await nextPaint()
  await wait(180)
}

export const hideNativeSplashAfterPaint = async () => {
  if (!Capacitor.isNativePlatform()) return
  await waitForStableAppPaint()
  await SplashScreen.hide().catch(() => undefined)
}

let launchHandoffPromise: Promise<void> | null = null

export const finishLaunchHandoff = () => {
  if (launchHandoffPromise) return launchHandoffPromise

  launchHandoffPromise = (async () => {
    await waitForStableAppPaint()
    document.getElementById('__splash')?.remove()

    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide().catch(() => undefined)
    }
  })()

  return launchHandoffPromise
}
