import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react'
import type { AppTab, InvestmentAllocationOverview } from '../types'
import type { ToastTone, ToastAction } from '../components/ui/ToastViewport'
import { usePushNotifications, type UsePushNotificationsResult } from './usePushNotifications'
import { useReceiptScanPolling } from '../lib/useReceiptScanPolling'
import { useReceiptSplitPolling } from '../lib/useReceiptSplitPolling'
import { useInvestmentScanPolling } from '../lib/useInvestmentScanPolling'
import { useInvestmentRefreshCoordinator } from './useInvestmentRefreshCoordinator'
import { usePendingScanUploads } from './usePendingScanUploads'
import type { ScanUploadKind } from '../lib/scanUploadStore'

export interface ScanPollingResults {
  receiptScan: ReturnType<typeof useReceiptScanPolling>
  receiptSplit: ReturnType<typeof useReceiptSplitPolling>
  investmentScan: ReturnType<typeof useInvestmentScanPolling>
}

interface RuntimeBackgroundBridgesProps {
  account: string | null
  token: string
  urgentPush: boolean
  isOffline: boolean
  activeTabRef: MutableRefObject<AppTab>
  isLedgerAddOpenRef: MutableRefObject<boolean>
  isReceiptSplitOpenRef: MutableRefObject<boolean>
  isInvestmentAddOpenRef: MutableRefObject<boolean>
  setActiveTab: (tab: AppTab) => void
  setAutoOpenLedgerAdd: (open: boolean) => void
  setAutoOpenReceiptSplit: (open: boolean) => void
  setAutoOpenInvestmentAdd: (open: boolean) => void
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  onPushChange: (push: UsePushNotificationsResult) => void
  onScansChange: (scans: ScanPollingResults) => void
  onInvestmentAllocationChange: (allocation: InvestmentAllocationOverview | null) => void
}

export function RuntimeBackgroundBridges(props: RuntimeBackgroundBridgesProps) {
  const push = usePushNotifications(true, props.showToast, props.account, props.urgentPush)
  const investmentAllocation = useInvestmentRefreshCoordinator(true, props.isOffline)
  const receiptScan = useReceiptScanPolling({
    token: props.token,
    activeTabRef: props.activeTabRef,
    isLedgerAddOpenRef: props.isLedgerAddOpenRef,
    setActiveTab: props.setActiveTab,
    setAutoOpenLedgerAdd: props.setAutoOpenLedgerAdd,
    showToast: props.showToast,
  })
  const receiptSplit = useReceiptSplitPolling({
    token: props.token,
    isReceiptSplitOpenRef: props.isReceiptSplitOpenRef,
    setActiveTab: props.setActiveTab,
    setAutoOpenReceiptSplit: props.setAutoOpenReceiptSplit,
    showToast: props.showToast,
  })
  const investmentScan = useInvestmentScanPolling({
    token: props.token,
    activeTabRef: props.activeTabRef,
    isInvestmentAddOpenRef: props.isInvestmentAddOpenRef,
    setActiveTab: props.setActiveTab,
    setAutoOpenInvestmentAdd: props.setAutoOpenInvestmentAdd,
    showToast: props.showToast,
  })

  // An upload the app never finished sending is finished here, and its job id joins the same
  // tracking a scan started in the foreground uses.
  const showToast = props.showToast
  const startedByKind = useCallback((kind: ScanUploadKind, scanId: string) => {
    if (kind === 'receipt') receiptScan.handleReceiptScanStarted(scanId)
    else if (kind === 'receipt-split') receiptSplit.handleReceiptSplitStarted(scanId, false)
    else investmentScan.handleInvestmentScanStarted(scanId)
  }, [
    receiptScan.handleReceiptScanStarted,
    receiptSplit.handleReceiptSplitStarted,
    investmentScan.handleInvestmentScanStarted,
  ])
  usePendingScanUploads({
    enabled: Boolean(props.token),
    onScanStarted: startedByKind,
    showToast,
  })

  const pushResult = useMemo(() => push, [
    push.supported, push.loading, push.busy, push.busyAction,
    push.billRemindersEnabled, push.categoryAlertsEnabled,
    push.otherDevicesBillReminders, push.otherDevicesCategoryAlerts,
    push.enrolmentRevision, push.guidance, push.setChannelEnabled, push.refresh,
  ])
  const scanResults = useMemo(() => ({ receiptScan, receiptSplit, investmentScan }), [
    receiptScan.activeReceiptScanDraft, receiptScan.failedScanJob, receiptScan.receiptScanJobIds,
    receiptScan.handleReceiptScanStarted, receiptScan.clearReceiptScanJob,
    receiptSplit.activeReceiptSplitDraft, receiptSplit.failedReceiptSplitJob, receiptSplit.receiptSplitJobIds,
    receiptSplit.handleReceiptSplitStarted, receiptSplit.releaseReceiptSplitReview, receiptSplit.clearReceiptSplitJob,
    investmentScan.activeInvestmentScanDraft, investmentScan.failedInvestmentScanJob, investmentScan.investmentScanJobIds,
    investmentScan.handleInvestmentScanStarted, investmentScan.clearInvestmentScanJob,
  ])
  useEffect(() => props.onPushChange(pushResult), [props.onPushChange, pushResult])
  useEffect(() => props.onScansChange(scanResults), [props.onScansChange, scanResults])
  useEffect(() => props.onInvestmentAllocationChange(investmentAllocation), [
    props.onInvestmentAllocationChange,
    investmentAllocation,
  ])
  return null
}
