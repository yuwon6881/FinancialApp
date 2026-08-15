import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildForecastModel } from '../../../lib/investmentForecast'
import { useInvestmentForecast } from './useInvestmentForecast'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  readonly messages: unknown[] = []

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: unknown) {
    this.messages.push(message)
  }

  terminate() {}
}

const model = buildForecastModel({
  usEquityTarget: 66,
  internationalExUsTarget: 10,
  bondsTarget: 24,
  watchDrift: 3,
  alertDrift: 5,
})

describe('investment forecast worker contract', () => {
  afterEach(() => {
    vi.useRealTimers()
    FakeWorker.instances = []
    vi.unstubAllGlobals()
  })

  it('does not start before the panel is near view, initializes once, and posts zero for no target', () => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', FakeWorker)
    const { rerender, unmount } = renderHook(
      ({ enabled, monthlyContribution }) => useInvestmentForecast(
        model,
        { startValue: 10_000, monthlyContribution, horizonYears: 10, targetValue: 0 },
        enabled,
      ),
      { initialProps: { enabled: false, monthlyContribution: 100 } },
    )

    expect(FakeWorker.instances).toHaveLength(0)
    rerender({ enabled: true, monthlyContribution: 100 })
    expect(FakeWorker.instances).toHaveLength(1)
    const worker = FakeWorker.instances[0]
    expect(worker.messages).toHaveLength(1)
    expect(worker.messages[0]).toMatchObject({ type: 'initialize' })

    act(() => {
      worker.onmessage?.({ data: { type: 'initialized', requestId: 1, durationMs: 2 } } as MessageEvent)
    })
    act(() => { vi.advanceTimersByTime(60) })
    const calculations = () => worker.messages.filter(
      (message): message is { type: string; targetValue: number } =>
        typeof message === 'object' && message !== null && 'type' in message && (message as { type: string }).type === 'calculate',
    )
    expect(calculations()).toHaveLength(1)
    expect(calculations()[0].targetValue).toBe(0)

    rerender({ enabled: true, monthlyContribution: 200 })
    act(() => { vi.advanceTimersByTime(60) })
    expect(calculations()).toHaveLength(2)
    expect(worker.messages.filter(message => (message as { type?: string }).type === 'initialize')).toHaveLength(1)
    unmount()
  })
})
