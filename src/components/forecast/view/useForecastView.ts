import { useCallback, useEffect, useRef, useState } from 'react'
import type { CashFlowForecast, ForecastScenario, ForecastScenarioItem } from '../../../types'
import { fetchCashFlowForecast } from '../../../lib/api/forecast'
import { getErrorMessage } from '../../../lib/errors'
import {
  addScenarioItem,
  loadScenarioDraft,
  removeScenarioItem,
  saveScenarioDraft,
  toggleSkippedBill,
} from '../../../lib/forecastScenario'

/** Typing in an amount should not fire a request per keystroke. */
const REFRESH_DELAY_MS = 350

export function useForecastView(account: string, currency: string) {
  const [scenario, setScenario] = useState<ForecastScenario>(() => loadScenarioDraft(account, currency))
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [settled, setSettled] = useState<{ scenario: ForecastScenario; reloadKey: number; error: string | null } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    saveScenarioDraft(account, currency, scenario)
  }, [account, currency, scenario])

  useEffect(() => {
    const controller = new AbortController()
    const delay = isFirstLoad.current ? 0 : REFRESH_DELAY_MS
    isFirstLoad.current = false
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
    }, delay)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [scenario, reloadKey])

  const update = useCallback(<K extends 'cycles' | 'incomePerCycle' | 'everydaySpendingPerCycle'>(key: K, value: ForecastScenario[K]) => {
    setScenario(previous => previous[key] === value ? previous : { ...previous, [key]: value })
  }, [])
  const isLoading = settled?.scenario !== scenario || settled.reloadKey !== reloadKey

  return {
    scenario,
    forecast,
    error: isLoading ? null : settled.error,
    isLoading,
    setCycles: (cycles: number) => update('cycles', cycles),
    setIncome: (incomePerCycle: number | null) => update('incomePerCycle', incomePerCycle),
    setEverydaySpending: (everydaySpendingPerCycle: number | null) => update('everydaySpendingPerCycle', everydaySpendingPerCycle),
    addItem: (item: ForecastScenarioItem) => setScenario(previous => addScenarioItem(previous, item)),
    removeItem: (id: string) => setScenario(previous => removeScenarioItem(previous, id)),
    toggleBill: (billKey: string) => setScenario(previous => toggleSkippedBill(previous, billKey)),
    reset: () => setScenario(previous => ({ ...previous, items: [], skippedBills: [] })),
    retry: () => setReloadKey(key => key + 1),
  }
}
