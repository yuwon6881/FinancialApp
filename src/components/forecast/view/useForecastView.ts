import { useCallback, useEffect, useRef, useState } from 'react'
import type { CashFlowForecast, ForecastScenario, ForecastScenarioItem } from '../../../types'
import { fetchCashFlowForecast } from '../../../lib/api/forecast'
import { getErrorMessage } from '../../../lib/errors'
import {
  addScenarioItem,
  clearScenarioDraft,
  emptyScenario,
  loadScenarioDraft,
  removeScenarioItem,
  saveScenarioDraft,
  toggleSkippedBill,
} from '../../../lib/forecastScenario'

/** Typing in an amount should not fire a request per keystroke. */
const REFRESH_DELAY_MS = 350

export function useForecastView() {
  const [scenario, setScenario] = useState<ForecastScenario>(loadScenarioDraft)
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    saveScenarioDraft(scenario)
    const controller = new AbortController()
    const delay = isFirstLoad.current ? 0 : REFRESH_DELAY_MS
    isFirstLoad.current = false
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      fetchCashFlowForecast(scenario, controller.signal)
        .then(result => {
          setForecast(result)
          setError(null)
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return
          setError(getErrorMessage(reason, 'Could not build the forecast'))
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false)
        })
    }, delay)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [scenario, reloadKey])

  const update = useCallback((change: Partial<ForecastScenario>) => {
    setScenario(previous => ({ ...previous, ...change }))
  }, [])

  return {
    scenario,
    forecast,
    error,
    isLoading,
    setCycles: (cycles: number) => update({ cycles }),
    setIncome: (incomePerCycle: number | null) => update({ incomePerCycle }),
    setEverydaySpending: (everydaySpendingPerCycle: number | null) => update({ everydaySpendingPerCycle }),
    addItem: (item: ForecastScenarioItem) => setScenario(previous => addScenarioItem(previous, item)),
    removeItem: (id: string) => setScenario(previous => removeScenarioItem(previous, id)),
    toggleBill: (billKey: string) => setScenario(previous => toggleSkippedBill(previous, billKey)),
    reset: () => {
      clearScenarioDraft()
      // Income and everyday spending are the user's own baseline, so Reset keeps them and only
      // drops the what-ifs layered on top.
      setScenario(previous => ({ ...emptyScenario(), cycles: previous.cycles, incomePerCycle: previous.incomePerCycle, everydaySpendingPerCycle: previous.everydaySpendingPerCycle }))
    },
    retry: () => setReloadKey(key => key + 1),
  }
}
