import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Save, Settings, Trash2, AlertCircle, CheckCircle2, Fingerprint, ShieldCheck, Bell, ChevronDown, ChevronUp, Lock, Unlock, MonitorSmartphone, CalendarDays, LogOut, Sparkles, Loader2 } from 'lucide-react'
import type { DashboardData, TransactionCategory } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { RowSyncBadge } from './ui/RowSyncBadge'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { getCycleRangeDates, getStartOfNCyclesAgo, getCurrentCycleYearAndMonth, formatDateForApi } from '../lib/cycle'
import * as api from '../lib/api'
import type { CategoryCleanupSuggestion, FingerprintCredentialSummary, SessionSummary } from '../lib/api'
import { isPlatformAuthenticatorAvailable, createFingerprintCredential, getFriendlyDeviceLabel, base64UrlToHex } from '../lib/webauthn'
import type { ToastTone } from './ui/ToastViewport'
import { ToggleButton } from './ui/ToggleButton'
import { TwoFactorSection } from './TwoFactorSection'
import { ChangePasswordSection } from './ChangePasswordSection'
import { CollapsibleBody } from './ui/CollapsibleBody'
import { getErrorMessage, getErrorName } from '../lib/errors'

const formatRelativeTime = (iso: string | null): string => {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMinutes = Math.round(diffMs / 60000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

const DEVICE_CREDENTIAL_ID_KEY = 'fingerprint_credential_id_on_this_device'
type AllocationKey = 'essentials' | 'growth' | 'stability' | 'rewards'

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
    stabilityOverflowRedirect?: string
  }) => void
  onAddCategory: (category: Omit<TransactionCategory, 'id'>) => void
  onDeleteCategory: (id: string) => void
  onApplyCategoryCleanupSuggestion?: (suggestion: CategoryCleanupSuggestion) => Promise<void> | void
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
  onApplyCategoryCleanupSuggestion,
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [essentialsAllocInput, setEssentialsAllocInput] = useState('')
  const [growthAllocInput, setGrowthAllocInput] = useState('')
  const [stabilityAllocInput, setStabilityAllocInput] = useState('')
  const [rewardsAllocInput, setRewardsAllocInput] = useState('')
  const [stabilityOverflowRedirectInput, setStabilityOverflowRedirectInput] = useState('Split: Growth 50%, Rewards 50%')
  const [cycleDayInput, setCycleDayInput] = useState('28')
  const [currencyInput, setCurrencyInput] = useState('USD')
  const [newCatName, setNewCatName] = useState('')
  const [lockedAllocations, setLockedAllocations] = useState<AllocationKey[]>([])
  const [globalAllocLock, setGlobalAllocLock] = useState(true)

  const toggleLock = (key: AllocationKey) => {
    setLockedAllocations(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 2) return prev
      return [...prev, key]
    })
  }
  const [showUsageDetails, setShowUsageDetails] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [usageTransactions, setUsageTransactions] = useState<{ category: string }[] | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [cleanupSuggestions, setCleanupSuggestions] = useState<CategoryCleanupSuggestion[]>([])
  const [cleanupReviewOpen, setCleanupReviewOpen] = useState(false)
  const [isReviewingCleanup, setIsReviewingCleanup] = useState(false)
  const [applyingCleanupId, setApplyingCleanupId] = useState<string | null>(null)
  const [cleanupReviewError, setCleanupReviewError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Anchored to today's real cycle, not activeSettings.selectedMonth/selectedYear --
    // that field tracks whatever cycle was last navigated to on the Dashboard/Ledger,
    // which is a different concept ("last viewed") and would otherwise make this
    // "recent usage" window silently drift to a stale period if the user had been
    // browsing an old month elsewhere before opening Settings.
    const { year: activeYear, monthIndex: activeMonthIdx } = getCurrentCycleYearAndMonth(activeSettings.cycleDay)

    const startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, activeSettings.cycleDay, USAGE_LOOKBACK_CYCLES)
    const endDate = getCycleRangeDates(activeYear, activeMonthIdx, activeSettings.cycleDay).end

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
  }, [activeSettings.cycleDay])

  // Fingerprint (WebAuthn) state
  const [fingerprintCredentials, setFingerprintCredentials] = useState<FingerprintCredentialSummary[]>([])
  const [fingerprintBusy, setFingerprintBusy] = useState(false)
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false)

  // Active Sessions state
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  const loadFingerprintCredentials = async () => {
    try {
      setFingerprintCredentials(await api.listFingerprintCredentials())
    } catch (err) {
      console.error(err)
    }
  }

  const loadSessions = async () => {
    try {
      setSessions(await api.getSessions())
    } catch (err) {
      console.error(err)
    }
  }

  const handleRevokeSession = async (id: string) => {
    if (hideSensitive) return
    try {
      await api.revokeSession(id)
      await loadSessions()
      onToast?.('Session revoked.', 'Session removed', 'success')
    } catch (err: unknown) {
      console.error(err)
      onToast?.(getErrorMessage(err, 'Failed to revoke session.'), 'Error', 'error')
    }
  }

  const handleRevokeAllOtherSessions = async () => {
    if (hideSensitive) return
    try {
      const { revokedCount } = await api.revokeAllSessions(true)
      await loadSessions()
      onToast?.(`Logged out ${revokedCount} other device(s).`, 'Devices logged out', 'success')
    } catch (err: unknown) {
      console.error(err)
      onToast?.(getErrorMessage(err, 'Failed to log out other devices.'), 'Error', 'error')
    }
  }

  useEffect(() => {
    loadFingerprintCredentials()
    loadSessions()
    isPlatformAuthenticatorAvailable().then(setPlatformAuthAvailable)
  }, [])

  const enrolledOnThisDevice = useMemo(() => {
    if (fingerprintCredentials.length === 0) return false
    const storedId = localStorage.getItem(DEVICE_CREDENTIAL_ID_KEY)
    if (!storedId) return false
    // Sentinel written when we know this device is enrolled but can't pin down
    // which specific credential id is ours (e.g. an InvalidStateError recovery).
    if (storedId === 'already_enrolled') return true
    // The server lists credentials by uppercase hex id. Historically we stored
    // the base64url credential id here instead, so match against both forms:
    // the hex we store now, and the legacy base64url converted to hex.
    const upper = storedId.toUpperCase()
    let legacyHex: string | null = null
    try { legacyHex = base64UrlToHex(storedId) } catch { legacyHex = null }
    return fingerprintCredentials.some(c => {
      const serverId = c.id.toUpperCase()
      return serverId === upper || (legacyHex !== null && serverId === legacyHex)
    })
  }, [fingerprintCredentials])

  const handleEnrollFingerprint = async () => {
    if (hideSensitive) return
    setFingerprintBusy(true)
    try {
      const { challengeId, options } = await api.getFingerprintRegisterOptions()
      const credential = await createFingerprintCredential(options)
      await api.verifyFingerprintRegistration(challengeId, credential, getFriendlyDeviceLabel())
      // Store the same uppercase-hex form the server reports so this device is
      // recognised as already-enrolled on the next load (see enrolledOnThisDevice).
      localStorage.setItem(DEVICE_CREDENTIAL_ID_KEY, base64UrlToHex(credential.id))
      await loadFingerprintCredentials()
      onToast?.('Fingerprint enabled on this device.', 'Fingerprint enabled', 'success')
    } catch (err: unknown) {
      console.error(err)
      if (getErrorName(err) === 'InvalidStateError') {
        // The authenticator already holds a credential for this account
        // (excludeCredentials matched) -- this device is already enrolled, so
        // reconcile state and tell the user rather than erroring. We can't tell
        // which stored credential is ours here, so mark it with the sentinel.
        localStorage.setItem(DEVICE_CREDENTIAL_ID_KEY, 'already_enrolled')
        await loadFingerprintCredentials()
        onToast?.('This device already has fingerprint enabled.', 'Already enabled', 'info')
      } else if (getErrorName(err) !== 'NotAllowedError') {
        onToast?.(getErrorMessage(err, 'Failed to register fingerprint on this device.'), 'Fingerprint error', 'error')
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
    } catch (err: unknown) {
      console.error(err)
      onToast?.(getErrorMessage(err, 'Failed to remove fingerprint credential.'), 'Fingerprint error', 'error')
    }
  }

  useEffect(() => {
    setTargetInput(activeSettings.targetStabilityFund.toString())
    setEssentialsAllocInput((activeSettings.essentialsAlloc * 100).toString())
    setGrowthAllocInput((activeSettings.growthAlloc * 100).toString())
    setStabilityAllocInput((activeSettings.stabilityAlloc * 100).toString())
    setRewardsAllocInput((activeSettings.rewardsAlloc * 100).toString())
    setCycleDayInput(activeSettings.cycleDay.toString())
    setStabilityOverflowRedirectInput(activeSettings.stabilityOverflowRedirect || 'Split: Growth 50%, Rewards 50%')
    setCurrencyInput(activeSettings.currency || 'USD')
  }, [
    activeSettings.targetStabilityFund,
    activeSettings.essentialsAlloc,
    activeSettings.growthAlloc,
    activeSettings.stabilityAlloc,
    activeSettings.rewardsAlloc,
    activeSettings.cycleDay,
    activeSettings.stabilityOverflowRedirect,
    activeSettings.currency
  ])

  // Rounded to avoid IEEE-754 float noise
  const allocSum = useMemo(() => {
    const e = parseFloat(essentialsAllocInput) || 0
    const g = parseFloat(growthAllocInput) || 0
    const s = parseFloat(stabilityAllocInput) || 0
    const r = parseFloat(rewardsAllocInput) || 0
    return Math.round(e + g + s + r)
  }, [essentialsAllocInput, growthAllocInput, stabilityAllocInput, rewardsAllocInput])

  const handleAllocationChange = (changedKey: AllocationKey, newValue: number) => {
    if (lockedAllocations.includes(changedKey)) return

    const current = {
      essentials: parseFloat(essentialsAllocInput) || 0,
      growth: parseFloat(growthAllocInput) || 0,
      stability: parseFloat(stabilityAllocInput) || 0,
      rewards: parseFloat(rewardsAllocInput) || 0
    }
    
    newValue = Math.round(Math.max(0, Math.min(100, newValue)) / 5) * 5
    const diff = newValue - current[changedKey]
    if (diff === 0) return

    const otherKeys = (['essentials', 'growth', 'stability', 'rewards'] as const).filter(k => k !== changedKey && !lockedAllocations.includes(k))

    if (otherKeys.length === 0) return

    const newAlloc = { ...current, [changedKey]: newValue }

    let remainingDiff = Math.round(diff)
    let startIdx = 0
    while (remainingDiff !== 0) {
      let adjusted = false
      const step = Math.min(5, Math.abs(remainingDiff))
      const sign = Math.sign(remainingDiff)
      
      for (let i = 0; i < otherKeys.length; i++) {
        const k = otherKeys[(startIdx + i) % otherKeys.length]
        if (sign > 0 && newAlloc[k] >= step) {
          newAlloc[k] -= step
          remainingDiff -= step
          adjusted = true
          startIdx = (startIdx + i + 1) % otherKeys.length
          break
        } else if (sign < 0 && newAlloc[k] <= 100 - step) {
          newAlloc[k] += step
          remainingDiff += step
          adjusted = true
          startIdx = (startIdx + i + 1) % otherKeys.length
          break
        }
      }
      if (!adjusted) {
        newAlloc[changedKey] -= remainingDiff
        break
      }
    }

    setEssentialsAllocInput(newAlloc.essentials.toString())
    setGrowthAllocInput(newAlloc.growth.toString())
    setStabilityAllocInput(newAlloc.stability.toString())
    setRewardsAllocInput(newAlloc.rewards.toString())
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    
    const target = parseFloat(targetInput)
    if (!targetInput.trim()) {
      newErrors.target = 'Target Stability Fund Limit is required.'
    } else if (isNaN(target) || target < 0) {
      newErrors.target = 'Please enter a valid target limit.'
    }

    if (!essentialsAllocInput.trim()) newErrors.essentials = 'Essentials allocation is required.'
    if (!growthAllocInput.trim()) newErrors.growth = 'Growth allocation is required.'
    if (!stabilityAllocInput.trim()) newErrors.stability = 'Stability allocation is required.'
    if (!rewardsAllocInput.trim()) newErrors.rewards = 'Rewards allocation is required.'

    if (allocSum !== 100) {
      newErrors.allocationSum = `Allocations must total exactly 100% (currently ${allocSum}%).`
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    const cycle = parseInt(cycleDayInput)
    if (isNaN(cycle)) return

    onUpdateSettings({
      targetStabilityFund: target,
      essentialsAlloc: (parseFloat(essentialsAllocInput) || 0) / 100,
      growthAlloc: (parseFloat(growthAllocInput) || 0) / 100,
      stabilityAlloc: (parseFloat(stabilityAllocInput) || 0) / 100,
      rewardsAlloc: (parseFloat(rewardsAllocInput) || 0) / 100,
      stabilityOverflowRedirect: stabilityOverflowRedirectInput,
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

  const handleAiCleanupReview = async () => {
    if (hideSensitive || isReviewingCleanup) return
    setCategoriesOpen(true)
    setCleanupReviewOpen(true)
    setCleanupReviewError(null)
    setIsReviewingCleanup(true)
    try {
      const result = await api.reviewCategoryCleanup()
      setCleanupSuggestions(result.suggestions)
      if (result.suggestions.length === 0) {
        onToast?.('AI did not find category cleanup changes worth proposing.', 'AI Review Complete', 'info')
      }
    } catch (err: unknown) {
      console.error(err)
      setCleanupReviewError(getErrorMessage(err, 'Could not review categories.'))
      onToast?.(getErrorMessage(err, 'Could not review categories.'), 'AI Review Failed', 'error')
    } finally {
      setIsReviewingCleanup(false)
    }
  }

  const handleApplyCleanupSuggestion = async (suggestion: CategoryCleanupSuggestion) => {
    if (hideSensitive || applyingCleanupId) return
    setApplyingCleanupId(suggestion.id)
    try {
      await onApplyCategoryCleanupSuggestion?.(suggestion)
      setCleanupSuggestions(prev => prev.filter(item => item.id !== suggestion.id))
    } finally {
      setApplyingCleanupId(null)
    }
  }

  const visibleCategories = categoriesList.filter(cat => {
    const lower = cat.name.toLowerCase()
    return lower !== 'transfer' && lower !== 'adjustment'
  })

  const categoryUsage = useMemo(() => {
    if (!usageTransactions) return null

    // usageTransactions is already fetched bounded to the lookback window, so every
    // entry here counts toward that window's usage -- no per-tx date check needed.
    const countByName = new Map<string, number>()
    for (const cat of visibleCategories) {
      countByName.set(cat.name.trim().toLowerCase(), 0)
    }

    for (const tx of usageTransactions) {
      const key = tx.category.trim().toLowerCase()
      if (countByName.has(key)) countByName.set(key, countByName.get(key)! + 1)
    }

    return visibleCategories
      .map(cat => ({ category: cat, count: countByName.get(cat.name.trim().toLowerCase())! }))
      .sort((a, b) => a.count - b.count)
  }, [usageTransactions, visibleCategories])

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
        <form noValidate onSubmit={handleSaveSettings} className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Financial Model</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Controls budget targets and cycle calculations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground block">Target Stability Fund Limit</span>
              <SmartAmountInput
                type="text"
                disabled={hideSensitive}
                value={targetInput}
                onChange={e => {
                  setTargetInput(e.target.value)
                  if (errors.target) {
                    setErrors(prev => ({ ...prev, target: '' }))
                  }
                }}
                className={`w-full px-3 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  hideSensitive 
                    ? 'border-transparent text-transparent blur-sm select-none pointer-events-none' 
                    : errors.target 
                      ? 'border-destructive focus:ring-destructive' 
                      : 'border-border focus:ring-blue-500'
                }`}
              />
              {errors.target && (
                <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {errors.target}
                </p>
              )}
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

          <div className="space-y-4 border-t border-border/30 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">Allocation Split</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Interact with sliders to auto-balance (total 100%).</p>
              </div>
              <button
                type="button"
                onClick={() => setGlobalAllocLock(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  globalAllocLock 
                    ? 'text-blue-500 bg-blue-500/10 border border-blue-500/20' 
                    : 'text-muted-foreground hover:bg-muted border border-border/40'
                }`}
              >
                {globalAllocLock ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                {globalAllocLock ? 'Locked' : 'Unlocked'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {([
                ['Essentials', essentialsAllocInput, 'essentials', 'accent-blue-500'],
                ['Growth', growthAllocInput, 'growth', 'accent-green-500'],
                ['Stability', stabilityAllocInput, 'stability', 'accent-purple-500'],
                ['Rewards', rewardsAllocInput, 'rewards', 'accent-amber-500'],
              ] satisfies Array<[string, string, AllocationKey, string]>).map(([label, value, key, accentClass]) => (
                <label key={label} className="space-y-2 block">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      {label}
                      <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); toggleLock(key); }}
                        className={`p-1.5 rounded-md transition ${lockedAllocations.includes(key) ? 'text-blue-500 bg-blue-500/10 border border-blue-500/20 shadow-sm shadow-blue-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border/50'}`}
                        title={lockedAllocations.includes(key) ? 'Unlock' : lockedAllocations.length >= 2 ? 'Max 2 locks reached' : 'Lock'}
                      >
                        {lockedAllocations.includes(key) ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                      </button>
                    </span>
                    <span className="text-foreground bg-secondary px-2 py-0.5 rounded-md">{Number(value).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    disabled={globalAllocLock || lockedAllocations.includes(key)}
                    value={value}
                    onChange={e => handleAllocationChange(key, parseFloat(e.target.value))}
                    className={`w-full h-2 rounded-full cursor-pointer ${accentClass} bg-border disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                </label>
              ))}
            </div>
            {errors.allocationSum && (
              <p className="text-xs text-destructive font-medium mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                {errors.allocationSum}
              </p>
            )}
          </div>

          <div className="space-y-3 border-t border-border/30 pt-4 pb-2">
            <div>
              <h4 className="text-xs font-bold text-foreground">Stability Overflow Redirection</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">When Stability limit is reached, overflow goes here.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {[
                { value: 'Essentials 100%', label: '100% Essential' },
                { value: 'Growth 100%', label: '100% Growth' },
                { value: 'Rewards 100%', label: '100% Reward' },
                { value: 'Split: Essentials 50%, Growth 50%', label: '50% Essential / 50% Growth' },
                { value: 'Split: Essentials 50%, Rewards 50%', label: '50% Essential / 50% Reward' },
                { value: 'Split: Growth 50%, Rewards 50%', label: '50% Growth / 50% Reward' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStabilityOverflowRedirectInput(opt.value)}
                  className={`flex items-center justify-center text-center w-full h-full min-h-[48px] px-3 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 ${
                    stabilityOverflowRedirectInput === opt.value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/20'
                      : 'border-border bg-background hover:border-border/80 text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 text-white cursor-pointer transition duration-150"
          >
            <Save className="size-3.5" />
            Save Configuration
          </motion.button>
        </form>

        <div className="space-y-6">

          <section className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setCategoriesOpen(o => !o)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCategoriesOpen(o => !o) } }}
              aria-expanded={categoriesOpen}
              className="flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="min-w-0">
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
              <div className="flex items-center gap-2 shrink-0">
                {categoryUsage && visibleCategories.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setShowUsageDetails(v => !v) }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground bg-background border border-border/60 hover:text-foreground hover:bg-muted transition cursor-pointer"
                    >
                      Usage
                      {showUsageDetails ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>

                    {showUsageDetails && (
                      <div className="absolute right-0 top-full mt-2 w-72 md:w-80 z-50 bg-card border border-border/80 shadow-lg rounded-xl p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Usage over the last {USAGE_LOOKBACK_CYCLES} cycles, least used first. Categories with no recent activity are good candidates to remove.
                        </p>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {categoryUsage.map(({ category, count }) => (
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
                                <span className="text-orange-500 font-semibold text-right text-[10px]">No activity in last {USAGE_LOOKBACK_CYCLES} cycles</span>
                              ) : (
                                <span className="text-muted-foreground font-semibold text-[10px]">{count}&times; in {USAGE_LOOKBACK_CYCLES} cycles</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); void handleAiCleanupReview() }}
                  disabled={hideSensitive || isReviewingCleanup || visibleCategories.length === 0}
                  title={hideSensitive ? 'Unhide balances to review' : 'AI category review'}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    isReviewingCleanup
                      ? 'ai-shimmer-border border-blue-500/35 bg-blue-500/5 text-blue-600 dark:text-blue-400'
                      : 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/30 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed'
                  }`}
                >
                  {isReviewingCleanup ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  AI
                </button>
                {categoriesOpen ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
              </div>
            </div>

            <CollapsibleBody open={categoriesOpen}>
            <div className="space-y-4 pt-4">

            {usageError && (
              <p className="text-[10px] font-semibold text-orange-500 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" />
                {usageError}
              </p>
            )}

            {(cleanupReviewOpen || cleanupReviewError) && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Sparkles className="size-3.5 text-blue-500" />
                    AI Category Review
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCleanupReviewOpen(false); setCleanupReviewError(null) }}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition cursor-pointer"
                    aria-label="Close AI category review"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                </div>

                {isReviewingCleanup && (
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-blue-500" />
                    Reviewing category usage...
                  </div>
                )}

                {cleanupReviewError && (
                  <p className="text-[11px] font-semibold text-orange-500 flex items-center gap-1">
                    <AlertCircle className="size-3 shrink-0" />
                    {cleanupReviewError}
                  </p>
                )}

                {!isReviewingCleanup && !cleanupReviewError && cleanupSuggestions.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No cleanup proposals right now.
                  </p>
                )}

                {!isReviewingCleanup && cleanupSuggestions.length > 0 && (
                  <div className="space-y-2">
                    {cleanupSuggestions.map(suggestion => {
                      const confidence = Math.round(Math.max(0, Math.min(1, suggestion.confidence)) * 100)
                      const actionLabel = suggestion.type === 'merge'
                        ? `Merge to ${suggestion.targetCategory || 'category'}`
                        : suggestion.type === 'add'
                        ? `Add ${suggestion.newCategoryName || 'category'}`
                        : 'Remove category'
                      const isApplyingThis = applyingCleanupId === suggestion.id

                      return (
                        <div key={suggestion.id} className="rounded-lg border border-border/60 bg-background p-2.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground">{suggestion.title}</div>
                              <div className="text-[11px] text-muted-foreground leading-relaxed">{suggestion.summary}</div>
                            </div>
                            <span className="shrink-0 rounded-md border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-600 dark:text-blue-400">
                              {confidence}%
                            </span>
                          </div>

                          {suggestion.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {suggestion.categories.map(name => (
                                <span key={name} className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${getCategoryBadgeClass(name)}`}>
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {suggestion.affectedTransactionCount > 0
                                ? `${suggestion.affectedTransactionCount} ledger entr${suggestion.affectedTransactionCount === 1 ? 'y' : 'ies'} need validation`
                                : 'No ledger entries affected'}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleApplyCleanupSuggestion(suggestion)}
                              disabled={!onApplyCategoryCleanupSuggestion || applyingCleanupId !== null}
                              title={!onApplyCategoryCleanupSuggestion ? 'Category cleanup is unavailable' : actionLabel}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isApplyingThis ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                              {actionLabel}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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

            <div className="space-y-1.5 pt-1 px-px pb-px">
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
                <motion.button
                  whileHover={isCatValid ? { scale: 1.02 } : undefined}
                  whileTap={isCatValid ? { scale: 0.98 } : undefined}
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!isCatValid}
                  title={hideSensitive ? 'Unhide balances to edit' : undefined}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition duration-200 select-none ${
                    isCatValid
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer'
                      : 'bg-blue-600/50 text-white/50 shadow-none cursor-not-allowed'
                  }`}
                >
                  <Plus className="size-3.5" />
                  Add
                </motion.button>
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

            </div>
            </CollapsibleBody>
          </section>

          {/* Active Devices Section */}
          <section className="app-panel rounded-2xl border border-border/60 bg-card/92 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setDevicesOpen(o => !o)}
              aria-expanded={devicesOpen}
              className="w-full flex items-center gap-3 p-5 text-left cursor-pointer"
            >
              <div className="p-2 bg-blue-500/10 rounded-xl shrink-0">
                <MonitorSmartphone className="size-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">Active Devices</h3>
                <p className="text-[11px] text-muted-foreground">Manage devices currently logged into your account.</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{sessions.length}</span>
              {devicesOpen ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
            </button>

            <CollapsibleBody open={devicesOpen}>
            <div className="px-5 pb-5 border-t border-border/40 pt-4 space-y-4">

            <div className="space-y-1.5">
              {sessions.map(session => (
                <div key={session.id} className="flex items-center justify-between gap-2 bg-muted/20 border border-border/40 px-3 py-2.5 rounded-xl text-xs">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="flex items-center gap-2 text-foreground font-semibold truncate">
                      <MonitorSmartphone className="size-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{session.deviceName || 'Unknown Device'}</span>
                      {session.isCurrent && (
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">Current</span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3 opacity-70" />
                        Logged in: {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                      <span>&middot; Last active: {formatRelativeTime(session.lastActiveAt)}</span>
                    </span>
                    {session.ipAddress && (
                      <span className="text-[10px] text-muted-foreground/75 mt-0.5 block">
                        IP: {session.ipAddress}
                      </span>
                    )}
                  </div>
                  {!session.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={hideSensitive}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      title={hideSensitive ? 'Unhide balances to edit' : 'Log out this device'}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {sessions.length > 1 && (
              <button
                type="button"
                onClick={handleRevokeAllOtherSessions}
                disabled={hideSensitive}
                className="press-scale w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-40 transition cursor-pointer"
              >
                <LogOut className="size-3.5" /> Log out all other devices
              </button>
            )}

            </div>
            </CollapsibleBody>
          </section>

          <TwoFactorSection hideSensitive={hideSensitive} onToast={onToast} />

          <ChangePasswordSection hideSensitive={hideSensitive} onToast={onToast} />

          {/* Notifications Section */}
          <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
              <Bell className="size-5 text-blue-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                <p className="text-[11px] text-muted-foreground">Automatically show subscription reminders upon launching the application.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-foreground">Show subscription reminders automatically on startup</span>
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
