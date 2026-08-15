import { describe, expect, it } from 'vitest'
import { cacheWillUpdate } from './swCachePolicy'

describe('service-worker asset cache policy', () => {
  it('accepts a successful JavaScript response', async () => {
    const response = new Response('export default {}', {
      status: 200,
      headers: { 'content-type': 'application/javascript' },
    })

    await expect(cacheWillUpdate({ response })).resolves.toBe(response)
  })

  it('refuses an HTML body even when the host returned 200', async () => {
    const response = new Response('<!doctype html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })

    await expect(cacheWillUpdate({ response })).resolves.toBeNull()
  })

  it('refuses non-success asset responses', async () => {
    const response = new Response('missing', {
      status: 404,
      headers: { 'content-type': 'application/javascript' },
    })

    await expect(cacheWillUpdate({ response })).resolves.toBeNull()
  })
})
