import { useEffect, useRef } from 'react'
import type { AppTab } from '../types'
import type { useCycleNavigation } from './useCycleNavigation'

export function useTabNavigationCleanup(
  activeTab: AppTab,
  nav: ReturnType<typeof useCycleNavigation>,
) {
  const activeTabRef = useRef(activeTab)

  useEffect(() => {
    const prevTab = activeTabRef.current
    if (prevTab !== activeTab) {
      if (prevTab === 'ledger') {
        nav.setAutoOpenLedgerAdd(false)
        nav.setAutoOpenLedgerTxType(null)
        nav.setAutoOpenLedgerPrefill(null)
        nav.setAutoOpenReceiptSplit(false)
        if (nav.highlightedTxId) nav.clearHighlightedTx()
      }
      if (prevTab === 'recurring') {
        nav.setAutoOpenSubscriptionAdd(false)
        if (nav.highlightedRecurringId) nav.clearHighlightedRecurring()
        if (nav.highlightedLoanId) nav.clearHighlightedLoan()
      }
      if (prevTab === 'wishlist') {
        nav.setAutoOpenWishlistAdd(false)
        if (nav.highlightedCommitmentId) nav.clearHighlightedCommitment()
        if (nav.highlightedRewardId) nav.clearHighlightedReward()
      }
      if (prevTab === 'drafts') {
        if (nav.highlightedDraftId) nav.clearHighlightedDraft()
      }
      if (prevTab === 'reports') {
        if (nav.highlightedReportSection || nav.highlightedReportCategory) nav.clearHighlightedReportSection()
      }
      if (prevTab === 'settings') {
        if (nav.highlightedAccountId) nav.clearHighlightedAccount()
      }
      activeTabRef.current = activeTab
    }
  }, [
    activeTab,
    nav.setAutoOpenLedgerAdd,
    nav.setAutoOpenLedgerTxType,
    nav.setAutoOpenLedgerPrefill,
    nav.setAutoOpenReceiptSplit,
    nav.setAutoOpenSubscriptionAdd,
    nav.setAutoOpenWishlistAdd,
    nav.highlightedCommitmentId,
    nav.clearHighlightedCommitment,
    nav.highlightedRewardId,
    nav.clearHighlightedReward,
    nav.highlightedDraftId,
    nav.clearHighlightedDraft,
    nav.highlightedTxId,
    nav.clearHighlightedTx,
    nav.highlightedRecurringId,
    nav.clearHighlightedRecurring,
    nav.highlightedLoanId,
    nav.clearHighlightedLoan,
    nav.highlightedReportSection,
    nav.highlightedReportCategory,
    nav.clearHighlightedReportSection,
    nav.highlightedAccountId,
    nav.clearHighlightedAccount,
  ])

  return activeTabRef
}
