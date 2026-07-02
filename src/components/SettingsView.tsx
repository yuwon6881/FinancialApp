import React, { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Moon, Plus, Save, Settings, Sun, Trash2 } from 'lucide-react'
import type { DashboardData, TransactionCategory } from '../types'
import { CustomSelect } from './ui/CustomSelect'
import { getCategoryBadgeClass } from '../lib/categoryColors'

interface SettingsViewProps {
  dashboardData: DashboardData | null
  categoriesList: TransactionCategory[]
  darkMode: boolean
  hideSensitive: boolean
  onToggleDarkMode: () => void
  onToggleHideSensitive: () => void
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
  onToggleDarkMode,
  onToggleHideSensitive,
  onUpdateSettings,
  onAddCategory,
  onDeleteCategory
}) => {
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

  const allocSum = useMemo(() => {
    const e = parseFloat(essentialsAllocInput) || 0
    const g = parseFloat(growthAllocInput) || 0
    const s = parseFloat(stabilityAllocInput) || 0
    const r = parseFloat(rewardsAllocInput) || 0
    return e + g + s + r
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
    const trimmed = newCatName.trim()
    if (!trimmed) return

    const lower = trimmed.toLowerCase()
    if (lower === 'transfer' || lower === 'adjustment') return

    onAddCategory({ name: trimmed })
    setNewCatName('')
  }

  const visibleCategories = categoriesList.filter(cat => {
    const lower = cat.name.toLowerCase()
    return lower !== 'transfer' && lower !== 'adjustment'
  })

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                inputMode="decimal"
                enterKeyHint="done"
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
            <div>
              <h4 className="text-xs font-bold text-foreground">Allocation Split</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">Percentages must add up to 100.</p>
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
                    inputMode="decimal"
                    enterKeyHint="done"
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
            <div>
              <h3 className="text-sm font-bold text-foreground">App Preferences</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Privacy and appearance shortcuts.</p>
            </div>

            <button
              type="button"
              onClick={onToggleHideSensitive}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-background border border-border hover:bg-muted/40 transition cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                {hideSensitive ? <Eye className="size-4 text-blue-500" /> : <EyeOff className="size-4 text-blue-500" />}
                Sensitive values
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">{hideSensitive ? 'Hidden' : 'Visible'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleDarkMode}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-background border border-border hover:bg-muted/40 transition cursor-pointer"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                {darkMode ? <Sun className="size-4 text-blue-500" /> : <Moon className="size-4 text-blue-500" />}
                Theme
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">{darkMode ? 'Dark' : 'Light'}</span>
            </button>
          </section>

          <section className="p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Transaction Categories</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{visibleCategories.length} active categories.</p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 select-none">
              {visibleCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between gap-2 bg-background border border-border/50 px-2.5 py-2 rounded-lg text-xs">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${getCategoryBadgeClass(cat.name)}`}>
                    {cat.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(cat.id)}
                    className="p-1.5 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 rounded-lg cursor-pointer transition"
                    title="Delete category"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 items-center pt-1">
              <input
                type="text"
                placeholder="New category name"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCategory()
                  }
                }}
                className="flex-1 min-w-0 px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition"
              >
                <Plus className="size-3.5" />
                Add
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
