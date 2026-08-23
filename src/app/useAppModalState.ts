import { useState, useRef, useEffect } from 'react'
import type { InvestmentAllocationOverview } from '../types'
import type { UsePushNotificationsResult } from './usePushNotifications'
import type { ScanPollingResults } from './RuntimeBackgroundBridges'

export const EMPTY_PUSH: UsePushNotificationsResult = {
  supported: true,
  loading: true,
  busy: false,
  busyAction: null,
  billRemindersEnabled: false,
  categoryAlertsEnabled: false,
  otherDevicesBillReminders: false,
  otherDevicesCategoryAlerts: false,
  enrolmentRevision: 0,
  guidance: null,
  setChannelEnabled: async () => false,
  refresh: async () => null,
}

export const EMPTY_SCANS: ScanPollingResults = {
  receiptScan: { activeReceiptScanDraft: null, failedScanJob: null, receiptScanJobIds: [], handleReceiptScanStarted: () => undefined, clearReceiptScanJob: async () => undefined },
  receiptSplit: { activeReceiptSplitDraft: null, failedReceiptSplitJob: null, receiptSplitJobIds: [], handleReceiptSplitStarted: () => undefined, clearReceiptSplitJob: async () => undefined },
  investmentScan: { activeInvestmentScanDraft: null, failedInvestmentScanJob: null, investmentScanJobIds: [], handleInvestmentScanStarted: () => undefined, clearInvestmentScanJob: async () => undefined },
}

export function useAppModalState() {
  const [push, setPush] = useState<UsePushNotificationsResult>(EMPTY_PUSH)
  const [scans, setScans] = useState<ScanPollingResults>(EMPTY_SCANS)
  const [investmentAllocation, setInvestmentAllocation] = useState<InvestmentAllocationOverview | null>(null)

  const [isLedgerAddOpen, setIsLedgerAddOpen] = useState(false)
  const isLedgerAddOpenRef = useRef(isLedgerAddOpen)
  useEffect(() => {
    isLedgerAddOpenRef.current = isLedgerAddOpen
  }, [isLedgerAddOpen])

  const [isReceiptSplitOpen, setIsReceiptSplitOpen] = useState(false)
  const isReceiptSplitOpenRef = useRef(isReceiptSplitOpen)
  useEffect(() => {
    isReceiptSplitOpenRef.current = isReceiptSplitOpen
  }, [isReceiptSplitOpen])

  const [isInvestmentAddOpen, setIsInvestmentAddOpen] = useState(false)
  const isInvestmentAddOpenRef = useRef(isInvestmentAddOpen)
  const [autoOpenInvestmentAdd, setAutoOpenInvestmentAdd] = useState(false)
  useEffect(() => {
    isInvestmentAddOpenRef.current = isInvestmentAddOpen
  }, [isInvestmentAddOpen])

  return {
    push,
    setPush,
    scans,
    setScans,
    investmentAllocation,
    setInvestmentAllocation,
    isLedgerAddOpen,
    isLedgerAddOpenRef,
    setIsLedgerAddOpen,
    isReceiptSplitOpen,
    isReceiptSplitOpenRef,
    setIsReceiptSplitOpen,
    isInvestmentAddOpen,
    isInvestmentAddOpenRef,
    setIsInvestmentAddOpen,
    autoOpenInvestmentAdd,
    setAutoOpenInvestmentAdd,
  }
}
