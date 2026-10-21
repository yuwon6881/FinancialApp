import { createContext, useContext, type ReactNode } from 'react'
import type { Transaction } from '../types'
import type { usePurchaseCapture } from '../app/usePurchaseCapture'

export interface PurchaseCaptureActions {
  save: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void>
  edit: (id: string, fields: Record<string, unknown>) => Promise<void>
}

export const PurchaseCaptureContext = createContext<PurchaseCaptureActions | null>(null)
export const PurchaseCapturePanelContext = createContext<ReactNode>(null)
/** The whole detection runtime, for the permissions sheet. Null off Android. */
export const PurchaseCaptureDetectionContext = createContext<ReturnType<typeof usePurchaseCapture> | null>(null)
export const usePurchaseCaptureActions = () => useContext(PurchaseCaptureContext)
