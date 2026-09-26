import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { Transaction } from '../../types'

export interface PurchaseCapture {
  id: string
  transactionId: string
  sourcePackage: string
  sourceLabel: string
  capturedAt: number
  excerpt: string
  amount?: string
  currency?: string
  description?: string
  date?: string
  possibleDuplicate: boolean
  edits?: Record<string, unknown>
  prepared?: Omit<Transaction, 'id'>
  completed?: boolean
}

export interface CaptureState {
  enabled: boolean
  packages: string[]
  candidates: PurchaseCapture[]
  access: boolean
  notifications: boolean
  tapId?: string
}

export interface CaptureApplication { packageName: string; label: string }

export const PurchaseCapturePlugin = registerPlugin<{
  activate(options: { owner: string | null }): Promise<void>
  state(options: { owner: string }): Promise<CaptureState>
  applications(): Promise<{ applications: CaptureApplication[] }>
  configure(options: { owner: string; enabled: boolean; packages: string[] }): Promise<void>
  openAccessSettings(): Promise<void>
  requestNotifications(): Promise<void>
  openNotificationSettings(): Promise<void>
  update(options: { owner: string; id: string; action: 'edit' | 'prepare' | 'complete' | 'discard'; data?: Record<string, unknown> }): Promise<PurchaseCapture>
  consumeTap(options: { owner: string }): Promise<void>
  wipe(): Promise<void>
  addListener(event: 'changed', listener: () => void): Promise<PluginListenerHandle>
}>('PurchaseCapture')

export const supportsPurchaseCapture = () => Capacitor.getPlatform() === 'android'

export async function suspendPurchaseCapture(): Promise<void> {
  if (supportsPurchaseCapture()) await PurchaseCapturePlugin.activate({ owner: null })
}

export async function wipePurchaseCaptures(): Promise<void> {
  if (supportsPurchaseCapture()) await PurchaseCapturePlugin.wipe()
}
