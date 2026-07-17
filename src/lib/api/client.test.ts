import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedGet, invalidateCache } from './client'

describe('cachedGet', () => {
  beforeEach(() => {
    invalidateCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dedupes concurrent callers even when they pass AbortSignals', async () => {
    const load = vi.fn().mockResolvedValue('data')
    const a = cachedGet('key', load, { signal: new AbortController().signal })
    const b = cachedGet('key', load, { signal: new AbortController().signal })

    await expect(a).resolves.toBe('data')
    await expect(b).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('serves the cached promise to signal-less callers within staleTime', async () => {
    const load = vi.fn().mockResolvedValue('data')
    await cachedGet('key', load)
    await cachedGet('key', load)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('aborting one subscriber rejects only that subscriber and keeps the cache warm', async () => {
    let resolveLoad: (value: string) => void = () => {}
    const load = vi.fn().mockImplementation(
      () => new Promise<string>(resolve => { resolveLoad = resolve }),
    )
    const ac = new AbortController()
    const aborted = cachedGet('key', load, { signal: ac.signal })
    const kept = cachedGet('key', load, { signal: new AbortController().signal })

    ac.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })

    resolveLoad('data')
    await expect(kept).resolves.toBe('data')

    // The shared fetch completed despite the abort, so a later caller hits the cache.
    await expect(cachedGet('key', load)).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('rejects immediately for an already-aborted signal without evicting the cache', async () => {
    const load = vi.fn().mockResolvedValue('data')
    await cachedGet('key', load)

    const ac = new AbortController()
    ac.abort()
    await expect(cachedGet('key', load, { signal: ac.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })

    await expect(cachedGet('key', load)).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('evicts a failed load so the next caller retries', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('data')

    await expect(cachedGet('key', load)).rejects.toThrow('network down')
    await expect(cachedGet('key', load)).resolves.toBe('data')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reloads after staleTime expires', async () => {
    const load = vi.fn().mockResolvedValue('data')
    await cachedGet('key', load, { staleTime: 1000 })
    vi.advanceTimersByTime(1001)
    await cachedGet('key', load, { staleTime: 1000 })
    expect(load).toHaveBeenCalledTimes(2)
  })
})
