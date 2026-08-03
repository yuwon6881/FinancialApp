/// <reference lib="webworker" />

import {
  calculateForecast,
  generateForecastCoefficients,
  type ForecastCoefficients,
  type ForecastModel,
  type ForecastResult,
} from './investmentForecast'

export type ForecastWorkerRequest =
  | { type: 'initialize'; requestId: number; model: ForecastModel }
  | {
    type: 'calculate'
    requestId: number
    startValue: number
    monthlyContribution: number
    horizonYears: number
    targetValue: number
  }

export type ForecastWorkerResponse =
  | { type: 'initialized'; requestId: number; durationMs: number }
  | { type: 'complete'; requestId: number; result: ForecastResult }
  | { type: 'error'; requestId: number; message: string }

let coefficients: ForecastCoefficients | null = null

self.onmessage = (event: MessageEvent<ForecastWorkerRequest>) => {
  const request = event.data
  try {
    if (request.type === 'initialize') {
      const startedAt = performance.now()
      coefficients = generateForecastCoefficients(request.model)
      self.postMessage({
        type: 'initialized',
        requestId: request.requestId,
        durationMs: performance.now() - startedAt,
      } satisfies ForecastWorkerResponse)
      return
    }
    if (!coefficients) throw new Error('Forecast model is not ready yet.')
    const result = calculateForecast(
      coefficients,
      request.startValue,
      request.monthlyContribution,
      request.horizonYears,
      request.targetValue,
    )
    self.postMessage({ type: 'complete', requestId: request.requestId, result } satisfies ForecastWorkerResponse)
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'Forecast calculation failed.',
    } satisfies ForecastWorkerResponse)
  }
}
