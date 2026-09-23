import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineSupportRuntime } from './OfflineSupportRuntime'

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }))

vi.mock('virtual:pwa-register', () => ({ registerSW }))

describe('OfflineSupportRuntime', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true)
    registerSW.mockReset()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: vi.fn() },
    })
  })

  it('registers the web service worker without exposing an update prompt', async () => {
    render(<OfflineSupportRuntime />)

    await waitFor(() => expect(registerSW).toHaveBeenCalledOnce())
    expect(registerSW).toHaveBeenCalledWith(expect.objectContaining({ immediate: true }))
    expect(registerSW.mock.calls[0]?.[0]).not.toHaveProperty('onNeedRefresh')
  })
})
