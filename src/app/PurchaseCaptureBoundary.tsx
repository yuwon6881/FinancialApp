import { lazy, Suspense, useContext, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import type { AppTab } from '../types'
import type { PurchaseCaptureOptions } from './usePurchaseCapture'
import { PurchaseCapturePanelContext } from '../contexts/PurchaseCaptureContext'

const NativeBridge = lazy(() => import('./PurchaseCaptureBridge'))

export function PurchaseCapturePanelSlot() {
  return useContext(PurchaseCapturePanelContext)
}

export function PurchaseCaptureBoundary({ options, tab, children }: { options: PurchaseCaptureOptions; tab: AppTab; children: ReactNode }) {
  if (Capacitor.getPlatform() !== 'android') return children
  return <Suspense fallback={children}><NativeBridge options={options} tab={tab}>{children}</NativeBridge></Suspense>
}
