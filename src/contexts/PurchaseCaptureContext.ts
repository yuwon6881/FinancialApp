import { createContext, useContext, type ReactNode } from 'react'
import type { Transaction } from '../types'

export interface PurchaseCaptureActions {
  save: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void>
  edit: (id: string, fields: Record<string, unknown>) => Promise<void>
}

export const PurchaseCaptureContext = createContext<PurchaseCaptureActions | null>(null)
export const PurchaseCapturePanelContext = createContext<ReactNode>(null)
export const usePurchaseCaptureActions = () => useContext(PurchaseCaptureContext)
