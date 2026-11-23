import type { CashFlowForecast, ForecastScenario } from '../../types'
import { jsonBody, request } from './client'

/**
 * Evaluates a temporary scenario against the user's real balances, settings and bills. The
 * request only reads: nothing is saved, so it deliberately bypasses the outbox.
 */
export function fetchCashFlowForecast(scenario: ForecastScenario, signal?: AbortSignal): Promise<CashFlowForecast> {
  return request<CashFlowForecast>('/forecast/cash-flow', {
    method: 'POST',
    ...jsonBody({
      cycles: scenario.cycles,
      incomePerCycle: scenario.incomePerCycle,
      everydaySpendingPerCycle: scenario.everydaySpendingPerCycle,
      items: scenario.items.map(({ date, amount, bucket, label }) => ({ date, amount, bucket, label })),
      skippedBills: scenario.skippedBills,
    }),
    errorMessage: 'Could not build the forecast',
    signal,
  })
}
