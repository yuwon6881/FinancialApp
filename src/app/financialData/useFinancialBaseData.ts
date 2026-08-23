import { useState } from 'react'
import type {
  Transaction,
  RecurringPayment,
  TransactionCategory,
  WishlistItem,
  SavingsGoal,
  DashboardData,
  AutocompleteSuggestion,
  LedgerAccount,
} from '../../types'
import {
  CACHE_KEYS,
  ensureAccountTrackingCacheVersion,
  getCachedJSON,
  getCachedTransactions,
  getCachedWishlist,
} from '../../lib/cache'
import { useLoanData } from './useLoanData'

export function useFinancialBaseData() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => getCachedJSON(CACHE_KEYS.dashboardData, null))
  useState(() => {
    ensureAccountTrackingCacheVersion()
    return true
  })
  const [transactions, setTransactions] = useState<Transaction[]>(() => getCachedTransactions(CACHE_KEYS.transactions))
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(() => getCachedJSON(CACHE_KEYS.recurringPayments, []))
  const [categoriesList, setCategoriesList] = useState<TransactionCategory[]>(() => getCachedJSON(CACHE_KEYS.categories, []))
  const [walletBalance, setWalletBalance] = useState<number | null>(() => getCachedJSON<number | null>(CACHE_KEYS.walletBalance, null))
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => getCachedWishlist(CACHE_KEYS.wishlist))
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => getCachedJSON(CACHE_KEYS.savingsGoals, []))
  const [accounts, setAccounts] = useState<LedgerAccount[]>(() => getCachedJSON(CACHE_KEYS.accounts, []))
  const loanData = useLoanData()
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([])

  return {
    dashboardData,
    setDashboardData,
    transactions,
    setTransactions,
    recurringPayments,
    setRecurringPayments,
    categoriesList,
    setCategoriesList,
    walletBalance,
    setWalletBalance,
    wishlist,
    setWishlist,
    savingsGoals,
    setSavingsGoals,
    accounts,
    setAccounts,
    loanData,
    autocompleteSuggestions,
    setAutocompleteSuggestions,
  }
}
