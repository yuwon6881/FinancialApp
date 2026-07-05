import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Settings, Trash2, AlertCircle, CheckCircle2, Fingerprint, ShieldCheck, Bell, ChevronDown, ChevronUp } from 'lucide-react'
import type { DashboardData, TransactionCategory } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { RowSyncBadge } from './ui/RowSyncBadge'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { MONTH_NAMES, getCycleRangeDates, getStartOfNCyclesAgo, formatDateForApi } from '../lib/cycle'
import * as api from '../lib/api'
import type { FingerprintCredentialSummary } from '../lib/api'
import { isPlatformAuthenticatorAvailable, createFingerprintCredential, getFriendlyDeviceLabel } from '../lib/webauthn'
import type { ToastTone } from './ui/ToastViewport'
import { ToggleButton } from './ui/ToggleButton'

const DEVICE_CREDENTIAL_ID_KEY = 'fingerprint_credential_id_on_this_device'

// How far back to look when flagging a category as unused/rarely used. Long enough that
// categories only touched a couple times a year (insurance, annual renewals) aren't
// mislabeled after one quiet cycle, short enough to reflect current habits.
const USAGE_LOOKBACK_CYCLES = 6

interface SettingsViewProps {
  dashboardData: DashboardData | null
  categoriesList: TransactionCategory[]
  darkMode: boolean
  hideSensitive: boolean
  onToggleDarkMode?: () => void
  onToggleHideSensitive?: () => void
  onUpdateSettings: (settings: {
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
    currency?: string
  }) => void
  onAddCategory: (category: Omit<TransactionCategory, 'id'>) => void
  onDeleteCategory: (id: string) => void
  notifyOnLoginEnabled?: boolean
  onToggleNotifyOnLogin?: (checked: boolean) => void
  activeSyncId?: string | null
  deletingId?: string | null
  onToast?: (message: string, title?: string, tone?: ToastTone) => void
}

const getDayWithSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th'
  if (day % 10 === 1) return 'st'
  if (day % 10 === 2) return 'nd'
  if (day % 10 === 3) return 'rd'
  return 'th'
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  dashboardData,
  categoriesList,
  darkMode,
  hideSensitive,
  onUpdateSettings,
  onAddCategory,
  onDeleteCategory,
  notifyOnLoginEnabled = true,
  onToggleNotifyOnLogin,
  activeSyncId = null,
  deletingId = null,
  onToast
}) => {
  const isCatSyncing = (catId: string) => {
    return activeSyncId !== null && activeSyncId !== undefined && String(activeSyncId) === String(catId)
  }

  const isCatDeleting = (catId: string) => {
    if (deletingId && String(deletingId) === String(catId)) return true
    const found = categoriesList.find(c => String(c.id) === String(catId))
    return Boolean(found?.isPendingDelete)
  }

  const activeSettings = dashboardData?.setting || {
    targetStabilityFund: 10000,
    selectedMonth: 'Jun',
    selectedYear: 2026,
    essentialsAlloc: 0.5,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.1,
    cycleDay: 28,
    darkMode,
    hideSensitive,
    currency: 'USD'
  }

  const [targetInput, setTargetInput] = useState('')
  const [essentialsAllocInput, setEssentialsAllocInput] = useState('')
  const [growthAllocInput, setGrowthAllocInput] = useState('')
  const [stabilityAllocInput, setStabilityAllocInput] = useState('')
  const [rewardsAllocInput, setRewardsAllocInput] = useState('')
  const [cycleDayInput, setCycleDayInput] = useState('28')
  const [currencyInput, setCurrencyInput] = useState('USD')
  const [newCatName, setNewCatName] = useState('')
  const [showUsageDetails, setShowUsageDetails] = useState(false)
  const [usageTransactions, setUsageTransactions] = useState<{ category: string }[] | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const activeMonthIdx = MONTH_NAMES.indexOf(activeSettings.selectedMonth) + 1
    if (activeMonthIdx <= 0) return

    const startDate = getStartOfNCyclesAgo(activeSettings.selectedYear, activeMonthIdx, activeSettings.cycleDay, USAGE_LOOKBACK_CYCLES)
    const endDate = getCycleRangeDates(activeSettings.selectedYear, activeMonthIdx, activeSettings.cycleDay).end

    // pageSize is clamped to 500 server-side; comfortably covers 6 cycles for normal usage volumes.
    api.fetchPagedTransactions({
      page: 1,
      pageSize: 500,
      startDate: formatDateForApi(startDate),
      endDate: formatDateForApi(endDate)
    })
      .then(result => {
        if (!cancelled) setUsageTransactions(result.items.filter(t => !t.isPendingDelete))
      })
      .catch(() => {
        if (!cancelled) setUsageError('Could not load category usage.')
      })
    return () => { cancelled = true }
  }, [activeSettings.selectedMonth, activeSettings.selectedYear, activeSettings.cycleDay])

  // Fingerprint (WebAuthn) state
  const [fingerprintCredentials, setFingerprintCredentials] = useState<FingerprintCredentialSummary[]>([])
  const [fingerprintBusy, setFingerprintBusy] = useState(false)
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false)

  const loadFingerprintCredentials = async () => {
    try {
      setFingerprintCredentials(await api.listFingerprintCredentials())
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadFingerprintCredentials()
    isPlatformAuthenticatorAvailable().then(setPlatformAuthAvailable)
  }, [])

  const enrolledOnThisDevice = useMemo(() => {
    const storedId = localStorage.getItem(DEVICE_CREDENTIAL_ID_KEY)
    return !!storedId && fingerprintCredentials.some(c => c.id === storedId)
  }, [fingerprintCredentials])

  const handleEnrollFingerprint = async () => {
    if (hideSensitive) return
    setFingerprintBusy(true)
    try {
      const { challengeId, options } = await api.getFingerprintRegisterOptions()
      const credential = await createFingerprintCredential(options)
      await api.verifyFingerprintRegistration(challengeId, credential, getFriendlyDeviceLabel())
      localStorage.setItem(DEVICE_CREDENTIAL_ID_KEY, credential.id)
      await loadFingerprintCredentials()
      onToast?.('Fingerprint enabled on this device.', 'Fingerprint enabled', 'success')
    } catch (err: any) {
      console.error(err)
      if (err?.name === 'InvalidStateError') {
        // The authenticator already holds a credential for this account (excludeCredentials matched) -
        // this device is already enrolled, nothing went wrong.
        await loadFingerprintCredentials()
      } else if (err?.name !== 'NotAllowedError') {
        onToast?.(err.message || 'Failed to register fingerprint on this device.', 'Fingerprint error', 'error')
      }
    } finally {
      setFingerprintBusy(false)
    }
  }

  const handleRemoveFingerprint = async (id: string) => {
    if (hideSensitive) return
    try {
      await api.deleteFingerprintCredential(id)
      await loadFingerprintCredentials()
      onToast?.('Fingerprint credential removed.', 'Fingerprint removed', 'success')
    } catch (err: any) {
      console.error(err)
      onToast?.(err.message || 'Failed to remove fingerprint credential.', 'Fingerprint error', 'error')
    }
  }

  useEffect(() => {
    setTargetInput(activeSettings.targetStabilityFund.toString())
    setEssentialsAllocInput((activeSettings.essentialsAlloc * 100).toString())
    setGrowthAllocInput((activeSettings.growthAlloc * 100).toString())
    setStabilityAllocInput((activeSettings.stabilityAlloc * 100).toString())
    setRewardsAllocInput((activeSettings.rewardsAlloc * 100).toString())
    setCycleDayInput(activeSettings.cycleDay.toString())
    setCurrencyInput(activeSettings.currency || 'USD')
  }, [
    activeSettings.targetStabilityFund,
    activeSettings.essentialsAlloc,
    activeSettings.growthAlloc,
    activeSettings.stabilityAlloc,
    activeSettings.rewardsAlloc,
    activeSettings.cycleDay,
    activeSettings.currency
  ])

  // Rounded to avoid IEEE-754 float noise (e.g. 0 + 0.01 + 64.04 + 35.95 =
  // 100.00000000000001) permanently blocking a legitimately-100% split.
  const allocSum = useMemo(() => {
    const e = parseFloat(essentialsAllocInput) || 0
    const g = parseFloat(growthAllocInput) || 0
    const s = parseFloat(stabilityAllocInput) || 0
    const r = parseFloat(rewardsAllocInput) || 0
    return Math.round((e + g + s + r) * 100) / 100
  }, [essentialsAllocInput, growthAllocInput, stabilityAllocInput, rewardsAllocInput])

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (allocSum !== 100) return

    const target = parseFloat(targetInput)
    const cycle = parseInt(cycleDayInput)
    if (isNaN(target) || isNaN(cycle)) return

    onUpdateSettings({
      targetStabilityFund: target,
      essentialsAlloc: (parseFloat(essentialsAllocInput) || 0) / 100,
      growthAlloc: (parseFloat(growthAllocInput) || 0) / 100,
      stabilityAlloc: (parseFloat(stabilityAllocInput) || 0) / 100,
      rewardsAlloc: (parseFloat(rewardsAllocInput) || 0) / 100,
      cycleDay: cycle,
      currency: currencyInput
    })
  }

  const handleAddCategory = () => {
    if (hideSensitive) return
    const trimmed = newCatName.trim()
    if (!trimmed) return

    const lower = trimmed.toLowerCase()
    if (lower === 'transfer' || lower === 'adjustment') return
    if (categoriesList.some(c => c.name.trim().toLowerCase() === lower)) return

    onAddCategory({ name: trimmed })
    setNewCatName('')
  }

  const trimmedCatName = newCatName.trim()
  const isCatEmpty = trimmedCatName.length === 0
  const isCatDuplicate = useMemo(() => {
    if (isCatEmpty) return false
    return categoriesList.some(c => c.name.trim().toLowerCase() === trimmedCatName.toLowerCase())
  }, [categoriesList, trimmedCatName, isCatEmpty])

  const isCatReserved = useMemo(() => {
    const lower = trimmedCatName.toLowerCase()
    return lower === 'transfer' || lower === 'adjustment'
  }, [trimmedCatName])

  const isCatValid = !isCatEmpty && !isCatDuplicate && !isCatReserved && !hideSensitive

  const handleDeleteCategory = (id: string) => {
    if (hideSensitive) return
    onDeleteCategory(id)
  }

  const visibleCategories = categoriesList.filter(cat => {
    const lower = cat.name.toLowerCase()
    return lower !== 'transfer' && lower !== 'adjustment'
  })

  const categoryUsage = useMemo(() => {
    if (!usageTransactions) return null

    const activeMonthIdx = MONTH_NAMES.indexOf(activeSettings.selectedMonth) + 1
    if (activeMonthIdx <= 0) return null
    const rangeStart = getStartOfNCyclesAgo(activeSettings.selectedYear, activeMonthIdx, activeSettings.cycleDay, USAGE_LOOKBACK_CYCLES)
    const rangeEnd = getCycleRangeDates(activeSettings.selectedYear, activeMonthIdx, activeSettings.cycleDay).end

    const statsByName = new Map<string, { count: number; lastUsed: string | null }>()
    for (const cat of visibleCategories) {
      statsByName.set(cat.name.trim().toLowerCase(), { count: 0, lastUsed: null })
    }

    for (const tx of usageTransactions) {
      const stat = statsByName.get(tx.category.trim().toLowerCase())
      if (!stat) continue
      const txDate = new Date(tx.date)
      if (txDate >= rangeStart && txDate <= rangeEnd) stat.count++
      if (!stat.lastUsed || txDate > new Date(stat.lastUsed)) stat.lastUsed = tx.date
    }

    return visibleCategories
      .map(cat => ({ category: cat, ...statsByName.get(cat.name.trim().toLowerCase())! }))
      .sort((a, b) => a.count - b.count)
  }, [usageTransactions, visibleCategories, activeSettings.selectedMonth, activeSettings.selectedYear, activeSettings.cycleDay])

  const unusedCategoryCount = categoryUsage ? categoryUsage.filter(c => c.count === 0).length : 0

  return (
    <div className="space-y-6 soft-rise">
      <div className="flex flex-col gap-2 p-4 sm:p-6 bg-card rounded-2xl border border-border/60">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-blue-500" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage financial model rules, app preferences, and transaction categories.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] gap-6">
        <form onSubmit={handleSaveSettings} className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Financial Model</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Controls budget targets and cycle calculations.</p>
            </div>
            <span className={allocSum === 100 ? 'text-blue-500 text-xs font-bold' : 'text-orange-500 text-xs font-bold'}>
              Total: {allocSum}%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Target Stability Fund Limit</span>
              <input
                type="number"
                required
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Dashboard Currency</span>
              <CustomSelect
                value={currencyInput}
                onChange={val => setCurrencyInput(val)}
                options={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'MYR', label: 'MYR (RM)' },
                  { value: 'CNY', label: 'CNY' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'GBP', label: 'GBP' },
                  { value: 'SGD', label: 'SGD (S$)' }
                ]}
                className="w-full"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground">Cycle Start Date</span>
              <CustomSelect
                value={Number(cycleDayInput)}
                onChange={val => setCycleDayInput(val.toString())}
                options={Array.from({ length: 31 }, (_, i) => {
                  const d = i + 1
                  return { value: d, label: `${d}${getDayWithSuffix(d)}` }
                })}
                className="w-full"
              />
            </label>
          </div>

          <div className="space-y-3 border-t border-border/30 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">Allocation Split</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Percentages must add up to 100.</p>
              </div>
              <span className={`text-xs font-bold ${allocSum === 100 ? 'text-green-500 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20' : 'text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20 animate-pulse'}`}>
                {allocSum === 100 ? '✓ Ready (100%)' : `Total: ${allocSum}% (${allocSum < 100 ? `Needs +${100 - allocSum}%` : `Over by -${allocSum - 100}%`})`}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Essentials', essentialsAllocInput, setEssentialsAllocInput],
                ['Growth', growthAllocInput, setGrowthAllocInput],
                ['Stability', stabilityAllocInput, setStabilityAllocInput],
                ['Rewards', rewardsAllocInput, setRewardsAllocInput],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground block">{label as string} (%)</span>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={value as string}
                    onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={allocSum !== 100}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-md transition duration-150 ${
              allocSum === 100
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            }`}
          >
            <Save className="size-3.5" />
            Save Configuration
          </button>
        </form>

        <div className="space-y-6">

          <section className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Transaction Categories</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {visibleCategories.length} active categories.
                  {categoryUsage && unusedCategoryCount > 0 && (
                    <> · <span className="text-orange-500 font-semibold">{unusedCategoryCount} unused in last {USAGE_LOOKBACK_CYCLES} cycles</span></>
                  )}
                  {categoryUsage && unusedCategoryCount === 0 && visibleCategories.length > 0 && (
                    <> · <span className="text-emerald-500 font-semibold">all used recently</span></>
                  )}
                </p>
              </div>
              {categoryUsage && visibleCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUsageDetails(v => !v)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground bg-background border border-border/60 hover:text-foreground hover:bg-muted transition cursor-pointer"
                >
                  Usage
                  {showUsageDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>
              )}
            </div>

            {usageError && (
              <p className="text-[10px] font-semibold text-orange-500 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" />
                {usageError}
              </p>
            )}

            {showUsageDetails && categoryUsage && (
              <div className="space-y-1.5 pr-1 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                <p className="text-[10px] text-muted-foreground">
                  Usage over the last {USAGE_LOOKBACK_CYCLES} cycles, least used first. Categories with no recent activity are good candidates to remove.
                </p>
                {categoryUsage.map(({ category, count, lastUsed }) => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between gap-2 border px-2.5 py-1.5 rounded-lg text-[11px] ${
                      count === 0 ? 'bg-orange-500/5 border-orange-500/25' : 'bg-background border-border/50'
                    }`}
                  >
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${getCategoryBadgeClass(category.name)}`}>
                      {category.name}
                    </span>
                    {count === 0 ? (
                      <span className="text-orange-500 font-semibold text-right">
                        {lastUsed ? `Unused since ${new Date(lastUsed).toLocaleDateString()}` : 'Never used'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-semibold">{count}&times; in {USAGE_LOOKBACK_CYCLES} cycles</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 select-none">
              {visibleCategories.map(cat => {
                const isBusy = isCatDeleting(cat.id) || isCatSyncing(cat.id) || cat.isPendingSync
                return (
                <div key={cat.id} className="flex items-center justify-between gap-2 bg-background border border-border/50 px-2.5 py-2 rounded-lg text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${getCategoryBadgeClass(cat.name)}`}>
                      {cat.name}
                    </span>
                    {isCatDeleting(cat.id) ? (
                      <RowSyncBadge state="deleting" entityLabel="category" />
                    ) : (isCatSyncing(cat.id) || cat.isPendingSync) ? (
                      <RowSyncBadge state={isCatSyncing(cat.id) ? 'syncing' : 'pending'} entityLabel="category" />
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={isBusy || hideSensitive}
                    className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-lg cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                    title={hideSensitive ? 'Unhide balances to edit' : 'Delete category'}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )})}
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (isCatValid) handleAddCategory()
                    }
                  }}
                  className={`flex-1 min-w-0 px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none focus:ring-1 transition duration-150 ${
                    !isCatEmpty && (isCatDuplicate || isCatReserved)
                      ? 'border-orange-500/60 focus:ring-orange-500'
                      : !isCatEmpty && isCatValid
                      ? 'border-emerald-500/60 focus:ring-emerald-500'
                      : 'border-border focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!isCatValid}
                  title={hideSensitive ? 'Unhide balances to edit' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition duration-200 select-none
                    bg-blue-600 hover:bg-blue-700 text-white shadow-sm
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:shadow-none"
                >
                  <Plus className="size-3.5" />
                  Add
                </button>
              </div>

              {!isCatEmpty && isCatDuplicate && (
                <p className="text-[10px] font-semibold text-orange-500 flex items-center gap-1 animate-in fade-in duration-150">
                  <AlertCircle className="size-3 shrink-0" />
                  Category "{trimmedCatName}" already exists.
                </p>
              )}

              {!isCatEmpty && isCatReserved && (
                <p className="text-[10px] font-semibold text-orange-500 flex items-center gap-1 animate-in fade-in duration-150">
                  <AlertCircle className="size-3 shrink-0" />
                  "Transfer" and "Adjustment" are reserved system categories.
                </p>
              )}

              {!isCatEmpty && isCatValid && (
                <p className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1 animate-in fade-in duration-150">
                  <CheckCircle2 className="size-3 shrink-0" />
                  Category name is available.
                </p>
              )}
            </div>
          </section>

          {/* Notifications Section */}
          <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
              <Bell className="size-5 text-blue-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                <p className="text-[11px] text-muted-foreground">Controls the pending subscription reminder popup shown on login.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-foreground">Show subscription reminders automatically on login</span>
              <ToggleButton
                active={notifyOnLoginEnabled}
                onClick={() => onToggleNotifyOnLogin?.(!notifyOnLoginEnabled)}
                className="size-6 shrink-0"
              />
            </div>
          </section>

          {/* Security & Fingerprint Section */}
          {platformAuthAvailable && (
            <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
                <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Fingerprint Login</h3>
                  <p className="text-[11px] text-muted-foreground">Unlock the dashboard with this device's fingerprint or face unlock instead of your password.</p>
                </div>
              </div>

              {fingerprintCredentials.length > 0 && (
                <div className="space-y-1.5">
                  {fingerprintCredentials.map(cred => (
                    <div key={cred.id} className="flex items-center justify-between gap-2 bg-muted/20 border border-border/40 px-3 py-2.5 rounded-xl text-xs">
                      <span className="flex items-center gap-2 text-foreground font-semibold truncate">
                        <Fingerprint className="size-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{cred.deviceLabel || 'Registered device'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFingerprint(cred.id)}
                        disabled={hideSensitive}
                        className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-lg cursor-pointer transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        title={hideSensitive ? 'Unhide balances to edit' : 'Remove this fingerprint credential'}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {enrolledOnThisDevice ? (
                <div className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  Enabled on this device
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleEnrollFingerprint}
                  disabled={fingerprintBusy || hideSensitive}
                  title={hideSensitive ? 'Unhide balances to edit' : undefined}
                  className="press-scale w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20"
                >
                  {fingerprintBusy ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : (
                    <Fingerprint className="size-3.5" />
                  )}
                  {fingerprintCredentials.length > 0 ? 'Add another device' : 'Enable on this device'}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
