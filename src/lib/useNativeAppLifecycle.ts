import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { initNativeUi } from './nativeUi'

export function useNativeAppLifecycle(onStateChange: (isActive: boolean) => void | Promise<void>): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cleanup: (() => void) | undefined
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      void onStateChange(isActive)
    }).then(handle => {
      cleanup = () => { void handle.remove() }
    })
    return () => cleanup?.()
  }, [onStateChange])

  useEffect(() => {
    if (Capacitor.isNativePlatform()) void initNativeUi()
  }, [])
}
