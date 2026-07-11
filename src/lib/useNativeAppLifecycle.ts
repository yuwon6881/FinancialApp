import { useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { initNativeUi } from './nativeUi'

export function useNativeAppLifecycle(onResume: () => void | Promise<void>): void {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void onResume()
    }).then(handle => {
      cleanup = () => { void handle.remove() }
    })
    return () => cleanup?.()
  }, [onResume])

  useEffect(() => {
    void initNativeUi()
  }, [])
}
