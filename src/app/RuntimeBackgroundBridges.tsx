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
import { updateAppSearch } from '../lib/appLocation'
import { useAppPrefs } from '../contexts/AppContext'
import { PwaExperienceRuntime } from './PwaExperience'
import { usePwaShortcutAction, type PwaShortcutAction } from './pwaShortcutActions'
import type { useAppSession } from './useAppSession'

type ShortcutNavigation = {
  handleQuickAction: (action: 'transaction' | 'subscription' | 'wishlist') => void
  setAutoOpenLedgerAdd: (open: boolean) => void
  setAutoOpenLedgerTxType: (type: 'inflow' | 'outflow' | 'transfer' | null) => void
  setAutoOpenReceiptSplit: (open: boolean) => void
}
type RuntimeBridgeContext = readonly [
  navigation: ShortcutNavigation,
  requestSensitiveReveal: () => void,
  setActiveTab: (tab: AppTab) => void,
  setAutoOpenInvestmentAdd: (open: boolean) => void,
]

export interface ScanPollingResults {
  receiptScan: ReturnType<typeof useReceiptScanPolling>
  receiptSplit: ReturnType<typeof useReceiptSplitPolling>
  investmentScan: ReturnType<typeof useInvestmentScanPolling>
}

interface RuntimeBackgroundBridgesProps {
  session: Pick<ReturnType<typeof useAppSession>, 'username' | 'token'>
  bridge: RuntimeBridgeContext
  urgentPush: boolean
  isOffline: boolean
  activeTabRef: MutableRefObject<AppTab>
  isLedgerAddOpenRef: MutableRefObject<boolean>
  isReceiptSplitOpenRef: MutableRefObject<boolean>
  isInvestmentAddOpenRef: MutableRefObject<boolean>
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  onPushChange: (push: UsePushNotificationsResult) => void
  onScansChange: (scans: ScanPollingResults) => void
  onInvestmentAllocationChange: (allocation: InvestmentAllocationOverview | null) => void
}

export function RuntimeBackgroundBridges(props: RuntimeBackgroundBridgesProps) {
  const { hideSensitive, sensitivePreferenceStatus: contextSensitiveStatus } = useAppPrefs()
  const sensitivePreferenceStatus = contextSensitiveStatus ?? 'pending'
  const account = props.session.username
  const token = props.session.token!
  const [shortcutNavigation, onRequestSensitiveReveal, setActiveTab, setAutoOpenInvestmentAdd] = props.bridge
  const push = usePushNotifications(true, props.showToast, account, props.urgentPush)
  const investmentAllocation = useInvestmentRefreshCoordinator(true, props.isOffline)
  const receiptScan = useReceiptScanPolling({
    token,
    activeTabRef: props.activeTabRef,
    isLedgerAddOpenRef: props.isLedgerAddOpenRef,
    setActiveTab,
    setAutoOpenLedgerAdd: shortcutNavigation.setAutoOpenLedgerAdd,
    showToast: props.showToast,
  })
  const receiptSplit = useReceiptSplitPolling({
    token,
    isReceiptSplitOpenRef: props.isReceiptSplitOpenRef,
    setActiveTab,
    setAutoOpenReceiptSplit: shortcutNavigation.setAutoOpenReceiptSplit,
    showToast: props.showToast,
  })
  const investmentScan = useInvestmentScanPolling({
    token,
    activeTabRef: props.activeTabRef,
    isInvestmentAddOpenRef: props.isInvestmentAddOpenRef,
    setActiveTab,
    setAutoOpenInvestmentAdd,
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
    enabled: Boolean(token) && Boolean(account),
    ownerId: account,
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
  const runShortcutAction = useCallback((action: PwaShortcutAction) => {
    if (action === 'upcoming-bills') {
      setActiveTab('recurring')
      return
    }
    if (action === 'scan-receipt') updateAppSearch({ receiptScan: '1' })
    shortcutNavigation.handleQuickAction('transaction')
  }, [shortcutNavigation.handleQuickAction, setActiveTab])
  const clearShortcutAction = useCallback(() => {
    shortcutNavigation.setAutoOpenLedgerAdd(false)
    shortcutNavigation.setAutoOpenLedgerTxType(null)
    updateAppSearch({ receiptScan: null })
  }, [shortcutNavigation.setAutoOpenLedgerAdd, shortcutNavigation.setAutoOpenLedgerTxType])
  usePwaShortcutAction({
    actionReady: true,
    username: account ?? '',
    hideSensitive,
    sensitivePreferenceStatus,
    onRequestSensitiveReveal,
    onRunAction: runShortcutAction,
    onClearAction: clearShortcutAction,
  })
  return <PwaExperienceRuntime />
}
