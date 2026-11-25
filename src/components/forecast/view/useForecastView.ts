import { useCallback, useEffect, useState } from 'react'
import type { CashFlowForecast, ForecastScenario, ForecastScenarioItem } from '../../../types'
import { fetchCashFlowForecast } from '../../../lib/api/forecast'
import { getErrorMessage } from '../../../lib/errors'
import {
  addScenarioItems,
  loadScenarioDraft,
  removeScenarioItem,
  resetScenarioAdjustments,
  resetWhatIfs,
  saveScenarioDraft,
  toggleSkippedBill,
} from '../../../lib/forecastScenario'

/** Typing in an amount should not fire a request per keystroke. */
const REFRESH_DELAY_MS = 350

export function useForecastView(account: string, currency: string) {
  const [{ scenario, debounce }, setDraft] = useState(() => ({
    scenario: loadScenarioDraft(account, currency),
    debounce: false,
  }))
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [settled, setSettled] = useState<{ scenario: ForecastScenario; reloadKey: number; error: string | null } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    saveScenarioDraft(account, currency, scenario)
  }, [account, currency, scenario])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetchCashFlowForecast(scenario, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return
          setForecast(result)
          setSettled({ scenario, reloadKey, error: null })
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return
          setSettled({ scenario, reloadKey, error: getErrorMessage(reason, 'Could not build the forecast') })
        })
    }, debounce ? REFRESH_DELAY_MS : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [scenario, debounce, reloadKey])

  const changeScenario = useCallback((update: (previous: ForecastScenario) => ForecastScenario, debounce = false) => {
    setDraft(draft => {
      const scenario = update(draft.scenario)
      return scenario === draft.scenario ? draft : { scenario, debounce }
    })
  }, [])
  const update = useCallback(<K extends 'cycles' | 'incomePerCycle' | 'everydaySpendingPerCycle'>(key: K, value: ForecastScenario[K]) => {
    changeScenario(previous => previous[key] === value ? previous : { ...previous, [key]: value }, key !== 'cycles')
  }, [changeScenario])
  const isLoading = settled?.scenario !== scenario || settled.reloadKey !== reloadKey

  return {
    scenario,
    forecast,
    error: isLoading ? null : settled.error,
    isLoading,
    setCycles: (cycles: number) => update('cycles', cycles),
    setIncome: (incomePerCycle: number | null) => update('incomePerCycle', incomePerCycle),
    setEverydaySpending: (everydaySpendingPerCycle: number | null) => update('everydaySpendingPerCycle', everydaySpendingPerCycle),
    addItems: (items: ForecastScenarioItem[]) => changeScenario(previous => addScenarioItems(previous, items, 'what-if')),
    addAdjustments: (items: ForecastScenarioItem[]) => changeScenario(previous => addScenarioItems(previous, items, 'adjust')),
    removeItem: (id: string) => changeScenario(previous => removeScenarioItem(previous, id)),
    toggleBill: (billKey: string) => changeScenario(previous => toggleSkippedBill(previous, billKey)),
    reset: () => changeScenario(resetWhatIfs),
    resetAdjustments: () => changeScenario(resetScenarioAdjustments),
    retry: () => {
      setDraft(draft => draft.debounce ? { ...draft, debounce: false } : draft)
      setReloadKey(key => key + 1)
    },
  }
}
