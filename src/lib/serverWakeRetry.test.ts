import { describe, expect, it, vi } from 'vitest'
import { retryWhileServerWakes } from './serverWakeRetry'

const FAST_DELAYS = [5, 5, 5] as const

function flush(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('retryWhileServerWakes', () => {
  it('stops as soon as the probe reports an answer', async () => {
    const probe = vi.fn().mockResolvedValue(true)

    const stop = retryWhileServerWakes(probe, FAST_DELAYS)
    await flush(40)
    stop()

    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('keeps probing while the server has not answered, then stops on the answer', async () => {
    const probe = vi.fn()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue(true)

    const stop = retryWhileServerWakes(probe, FAST_DELAYS)
    await flush(60)
    stop()

    expect(probe).toHaveBeenCalledTimes(3)
  })

  it('gives up once the delay curve is exhausted', async () => {
    const probe = vi.fn().mockResolvedValue(false)

    const stop = retryWhileServerWakes(probe, FAST_DELAYS)
    await flush(80)
    stop()

    // The first run plus one attempt per configured delay.
    expect(probe).toHaveBeenCalledTimes(FAST_DELAYS.length + 1)
  })

  it('cancels a pending retry so a wait cannot outlive its caller', async () => {
    const probe = vi.fn().mockResolvedValue(false)

    const stop = retryWhileServerWakes(probe, [50])
    await flush(5)
    stop()
    await flush(80)

    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('retries immediately when the device comes back online', async () => {
    const probe = vi.fn().mockResolvedValue(false)

    const stop = retryWhileServerWakes(probe, [10_000])
    await flush(5)
    expect(probe).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('online'))
    await flush(5)
    stop()

    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('ignores reconnection once the probe has already answered', async () => {
    const probe = vi.fn().mockResolvedValue(true)

    const stop = retryWhileServerWakes(probe, FAST_DELAYS)
    await flush(5)
    window.dispatchEvent(new Event('online'))
    await flush(5)
    stop()

    expect(probe).toHaveBeenCalledTimes(1)
  })
})
