import { useState, useMemo, useEffect } from 'react'
import './App.css'
import TopNav from "./TopNav.tsx"
import { DashboardView } from './components/DashboardView'
import { RecurringPaymentsView } from './components/RecurringPaymentsView'
import { LedgerView } from './components/LedgerView'
import { LoginView } from './components/LoginView'
import type { Transaction, RecurringPayment, DashboardData, TransactionCategory } from './types'
import * as api from './lib/api'
import { Loader2 } from 'lucide-react'

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'))
  const [username, setUsername] = useState<string>(localStorage.getItem('auth_username') || '')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recurring' | 'ledger'>('dashboard')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([])
  const [categoriesList, setCategoriesList] = useState<TransactionCategory[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(0)
  const [hideSensitive, setHideSensitive] = useState<boolean>(() => {
    return localStorage.getItem('hide_sensitive') === 'true'
  })

  // Dark mode — initialize from localStorage immediately, sync with server after load
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('dark_mode') === 'true'
  })

  // Apply/remove the 'dark' class on <html> whenever darkMode changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Password Prompt for revealing sensitive information
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false)
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [promptError, setPromptError] = useState<string | null>(null)
  const [promptVerifying, setPromptVerifying] = useState<boolean>(false)

  // Login Notification Modal States
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false)
  const [hasShownModalThisSession, setHasShownModalThisSession] = useState<boolean>(false)
  const [modalCheckbox, setModalCheckbox] = useState<boolean>(
    localStorage.getItem('show_notifications_on_login') !== 'false'
  )

  // Fetch initial ledger and dashboard statistics
  async function loadAll(month?: string, year?: number) {
    if (!token) return
    setLoading(true)
    try {
      const [dbData, txs, recs, cats] = await Promise.all([
        api.fetchDashboard(month, year),
        api.fetchTransactions(month, year),
        api.fetchRecurringPayments(),
        api.fetchCategories()
      ])
      setSelectedMonth(dbData.setting.selectedMonth)
      setSelectedYear(dbData.setting.selectedYear)
      setDashboardData(dbData)
      setTransactions(txs)
      setRecurringPayments(recs)
      setCategoriesList(cats)
      setError(null)

      // Sync dark mode from server preference (server wins over localStorage)
      const serverDark = dbData.setting.darkMode ?? false
      setDarkMode(serverDark)
      localStorage.setItem('dark_mode', serverDark.toString())

      if (dbData.pendingNotifications && dbData.pendingNotifications.length > 0 && !hasShownModalThisSession) {
        if (localStorage.getItem('show_notifications_on_login') !== 'false') {
          setShowLoginModal(true)
        }
        setHasShownModalThisSession(true)
      }
    } catch (err: any) {
      console.error(err)
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'))) {
        handleLogout()
      } else {
        setError('Could not connect to the database API server. Running in offline view mode.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadAll()
    }
  }, [token])

  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    setToken(newToken)
    setUsername(newUsername)
    localStorage.setItem('auth_username', newUsername)
  }

  const handleLogout = async () => {
    await api.logout()
    setToken(null)
    setUsername('')
    setDashboardData(null)
    setTransactions([])
    setRecurringPayments([])
    setCategoriesList([])
    setHasShownModalThisSession(false)
    setShowLoginModal(false)
    localStorage.removeItem('auth_username')
  }

  // Period / Settings changes
  const handleSelectPeriod = async (month: string, year: number) => {
    try {
      await loadAll(month, year)
    } catch (err) {
      console.error(err)
      alert('Error updating active month.')
    }
  }

  const handleUpdateSettings = async (settings: {
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
  }) => {
    try {
      await api.updateSettings(settings)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error updating configuration on server.')
    }
  }

  // Custom Categories & Accounts modifiers
  const handleAddCategory = async (newCat: Omit<TransactionCategory, 'id'>) => {
    try {
      await api.addCategory(newCat)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error adding category.')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error deleting category.')
    }
  }


  // Transaction modifiers
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    try {
      await api.addTransaction(newTx)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error adding transaction on the server.')
    }
  }

  const handleDeleteTransaction = async (id: string) => {
    try {
      await api.deleteTransaction(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error deleting transaction on the server.')
    }
  }

  const handleConfirmSubscription = async (noti: any, paidDate: string) => {
    try {
      await api.addTransaction({
        id: noti.id,
        date: paidDate,
        description: noti.name,
        amount: -Math.abs(noti.amount),
        category: noti.category,
        ledgerCategory: noti.ledgerCategory
      })
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error confirming subscription payment.')
    }
  }


  // Recurring payment modifiers
  const handleAddPayment = async (newPay: Omit<RecurringPayment, 'id'>) => {
    try {
      await api.addRecurringPayment(newPay)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error adding recurring payment on the server.')
    }
  }

  const handleToggleActive = async (id: string) => {
    try {
      await api.toggleRecurringPayment(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error toggling payment status on the server.')
    }
  }

  const handleUpdatePayment = async (id: string, payment: RecurringPayment) => {
    try {
      await api.updateRecurringPayment(id, payment)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error updating recurring payment on the server.')
    }
  }

  const handleDeletePayment = async (id: string) => {
    try {
      await api.deleteRecurringPayment(id)
      await loadAll(selectedMonth || undefined, selectedYear || undefined)
    } catch (err) {
      console.error(err)
      alert('Error deleting recurring payment on the server.')
    }
  }

  // Calculate Net Worth for Top Nav summary display
  const totalBalance = useMemo(() => {
    if (dashboardData) {
      return dashboardData.stats.totalBalance
    }
    return transactions.reduce((acc, t) => acc + t.amount, 0)
  }, [transactions, dashboardData])

  const handlePostQuickTransaction = () => {
    setActiveTab('ledger')
  }

  const handleToggleHideSensitive = () => {
    if (hideSensitive) {
      setShowPasswordPrompt(true)
    } else {
      setHideSensitive(true)
      localStorage.setItem('hide_sensitive', 'true')
    }
  }

  const handleToggleDarkMode = async () => {
    const newDark = !darkMode
    setDarkMode(newDark)
    localStorage.setItem('dark_mode', newDark.toString())
    // Persist to server (non-blocking, non-fatal)
    api.updateDarkMode(newDark).catch(err => console.warn('Dark mode sync failed:', err))
  }

  if (!token) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-radial from-blue-400 to-blue-600 shadow-xl shadow-blue-500/20 text-white font-extrabold text-2xl animate-pulse">
            F
          </div>
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-muted-foreground mt-2 animate-pulse">
            <Loader2 className="animate-spin text-blue-500 size-4" />
            Syncing financial ledgers...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-blue-500/20 selection:text-blue-500">
      
      {/* Top Nav Component */}
      <TopNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        totalBalance={totalBalance}
        onPostQuickTransaction={handlePostQuickTransaction}
        hideSensitive={hideSensitive}
        onToggleHideSensitive={handleToggleHideSensitive}
        onLogout={handleLogout}
        username={username}
        pendingNotifications={dashboardData?.pendingNotifications || []}
        onConfirmSubscription={handleConfirmSubscription}
        onDeletePayment={handleDeletePayment}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {error && (
        <div className="bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-xs flex items-center justify-center gap-2 select-none">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {activeTab === 'dashboard' && (
          <DashboardView 
            dashboardData={dashboardData}
            onSelectPeriod={handleSelectPeriod}
            onUpdateSettings={handleUpdateSettings}
            onNavigate={setActiveTab}
            hideSensitive={hideSensitive}
            categoriesList={categoriesList}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onConfirmSubscription={handleConfirmSubscription}
            onDeletePayment={handleDeletePayment}
          />
        )}

        {activeTab === 'recurring' && (
          <RecurringPaymentsView 
            payments={recurringPayments}
            onAddPayment={handleAddPayment}
            onToggleActive={handleToggleActive}
            onDeletePayment={handleDeletePayment}
            onUpdatePayment={handleUpdatePayment}
            hideSensitive={hideSensitive}
            categories={categoriesList}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerView 
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            hideSensitive={hideSensitive}
            categories={categoriesList}
            cycleLabel={dashboardData?.cycleLabel || ''}
          />
        )}
      </main>

      {/* Modal Popup for Pending Subscriptions on Login */}
      {showLoginModal && dashboardData?.pendingNotifications && dashboardData.pendingNotifications.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <h3 className="text-md font-bold text-foreground">Pending Subscription Payments</h3>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer font-bold"
              >
                &times;
              </button>
            </div>

            <div className="text-xs text-muted-foreground">
              The following subscription renewals have arrived or passed. Please confirm which bills have been paid to register them in the ledger.
            </div>

            <div className="space-y-3 overflow-y-auto max-h-80 pr-1 py-1">
              {dashboardData.pendingNotifications.map((noti) => (
                <div key={noti.id} className="p-4 rounded-xl bg-muted/30 border border-border/40 shadow-xs flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-bold text-foreground text-xs block">{noti.name}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-block text-[9px] px-1.5 py-0.5 font-bold rounded border bg-slate-500/10 text-slate-500 border-slate-500/20">
                          {noti.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{noti.billingDate}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-orange-500 font-extrabold text-xs block transition-all duration-300 ${hideSensitive ? 'blur-sm select-none pointer-events-none' : ''}`}>
                        -{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(noti.amount)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{noti.cycleLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border/20 pt-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-muted-foreground">Paid Date:</span>
                      <input
                        type="date"
                        defaultValue={noti.billingDate}
                        id={`modal-date-${noti.id}`}
                        className="px-2.5 py-1 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => {
                          const dateVal = (document.getElementById(`modal-date-${noti.id}`) as HTMLInputElement)?.value || noti.billingDate
                          handleConfirmSubscription(noti, dateVal)
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm"
                      >
                        Confirm Paid
                      </button>
                      <button
                        onClick={() => {
                          const confirmResult = window.confirm("Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription.");
                          if (confirmResult) {
                            handleDeletePayment(noti.recurringPaymentId);
                          }
                        }}
                        className="px-3 py-1.5 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-xs rounded-lg transition duration-150 cursor-pointer border border-orange-500/10"
                      >
                        Remove Subscription
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalCheckbox}
                  onChange={(e) => {
                    setModalCheckbox(e.target.checked)
                    localStorage.setItem('show_notifications_on_login', e.target.checked ? 'true' : 'false')
                  }}
                  className="rounded border-border text-blue-500 focus:ring-blue-500"
                />
                Show this notification automatically every time I log in
              </label>
              <button
                onClick={() => setShowLoginModal(false)}
                className="px-4 py-2 bg-foreground text-background font-bold text-xs rounded-xl hover:bg-foreground/90 transition shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Gate Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h3 className="text-sm font-bold text-foreground">Verify Identity</h3>
              <button
                onClick={() => {
                  setShowPasswordPrompt(false)
                  setConfirmPassword('')
                  setPromptError(null)
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Please enter your password to confirm you are the owner before revealing sensitive financial figures.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setPromptVerifying(true)
                setPromptError(null)
                try {
                  const res = await api.verifyPassword(confirmPassword)
                   if (res.verified) {
                    setHideSensitive(false)
                    localStorage.setItem('hide_sensitive', 'false')
                    setShowPasswordPrompt(false)
                    setConfirmPassword('')
                  } else {
                    setPromptError(res.message || 'Incorrect password.')
                  }
                } catch (err) {
                  console.error(err)
                  setPromptError('Failed to contact verification server.')
                } finally {
                  setPromptVerifying(false)
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readonly')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                {promptError && (
                  <p className="text-[10px] text-orange-500 font-semibold mt-1">
                    {promptError}
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordPrompt(false)
                    setConfirmPassword('')
                    setPromptError(null)
                  }}
                  className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-xl cursor-pointer transition duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promptVerifying}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer transition duration-150 shadow-md shadow-blue-600/10"
                >
                  {promptVerifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 bg-muted/10 select-none">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          &copy; 2026 FinancialApp Inc. Double-Entry Safe Ledger System. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

export default App
