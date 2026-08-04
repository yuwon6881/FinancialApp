import { useEffect, useRef, useState } from 'react'
import type { ForecastModel, ForecastResult } from '../../lib/investmentForecast'
import type {
  ForecastWorkerRequest,
  ForecastWorkerResponse,
} from '../../lib/investmentForecast.worker'

interface ForecastRequest {
  startValue: number
  monthlyContribution: number
  horizonYears: number
  targetValue: number
}

export function useInvestmentForecast(model: ForecastModel, request: ForecastRequest, enabled: boolean) {
  const workerRef = useRef<Worker | null>(null)
  const latestRequestRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<ForecastResult | null>(null)
  const [error, setError] = useState('')
  const [initializationMs, setInitializationMs] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (typeof Worker === 'undefined') {
      setError('Forecasting is not supported on this device.')
      return
    }

    const worker = new Worker(
      new URL('../../lib/investmentForecast.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker
    setReady(false)
    setResult(null)
    setError('')
    const initializeId = ++latestRequestRef.current

    worker.onmessage = (event: MessageEvent<ForecastWorkerResponse>) => {
      const response = event.data
      if (response.type === 'initialized') {
        if (response.requestId !== initializeId) return
        setInitializationMs(response.durationMs)
        setReady(true)
        return
      }
      if (response.requestId !== latestRequestRef.current) return
      if (response.type === 'complete') {
        setResult(response.result)
        setError('')
      } else {
        setError(response.message)
      }
    }
    worker.onerror = () => setError('Forecast calculation failed on this device.')
    worker.postMessage({ type: 'initialize', requestId: initializeId, model } satisfies ForecastWorkerRequest)

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [enabled, model.annualReturn, model.annualVolatility, model.assumptionId])

  useEffect(() => {
    if (!enabled || !ready || !workerRef.current) return
    const timer = window.setTimeout(() => {
      const requestId = ++latestRequestRef.current
      workerRef.current?.postMessage({ type: 'calculate', requestId, ...request } satisfies ForecastWorkerRequest)
    }, 60)
    return () => window.clearTimeout(timer)
  }, [enabled, ready, request.startValue, request.monthlyContribution, request.horizonYears, request.targetValue])

  return { error, initializationMs, ready, result }
}
