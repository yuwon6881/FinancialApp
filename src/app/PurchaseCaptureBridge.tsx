import type { ReactNode } from 'react'
import type { AppTab } from '../types'
import { PurchaseCaptureContext, PurchaseCapturePanelContext } from '../contexts/PurchaseCaptureContext'
import { TransactionDetectionPanel } from '../components/settings/TransactionDetectionPanel'
import { usePurchaseCapture, type PurchaseCaptureOptions } from './usePurchaseCapture'

export default function PurchaseCaptureBridge({ options, tab, children }: { options: PurchaseCaptureOptions; tab: AppTab; children: ReactNode }) {
  const detection = usePurchaseCapture(options)
  return <PurchaseCaptureContext.Provider value={detection.actions}>
    <PurchaseCapturePanelContext.Provider value={<TransactionDetectionPanel detection={detection} tab={tab} hidden={options.hidden} formOpen={options.formOpen} />}>
      {children}
    </PurchaseCapturePanelContext.Provider>
  </PurchaseCaptureContext.Provider>
}
