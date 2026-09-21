import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPwaExperienceValue } from './pwaExperienceContext'
import { PwaExperienceRuntime } from './PwaExperience'

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }))

vi.mock('virtual:pwa-register', () => ({ registerSW }))

describe('PwaExperienceRuntime offline registration recovery', () => {
  let registrationOptions: {
    onRegisterError?: (error: unknown) => void
    onOfflineReady?: () => void
  } | undefined

  beforeEach(() => {
    vi.stubEnv('PROD', true)
    registrationOptions = undefined
    registerSW.mockReset()
    registerSW.mockImplementation((options: typeof registrationOptions) => {
      registrationOptions = options
      return async () => undefined
    })

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        ready: Promise.resolve({}),
      },
    })
  })

  it('publishes a registration failure and retries registration from the settings action', async () => {
    render(<PwaExperienceRuntime />)
    await waitFor(() => expect(registerSW).toHaveBeenCalledOnce())

    await act(async () => registrationOptions?.onRegisterError?.(new Error('registration failed')))
    await waitFor(() => expect(getPwaExperienceValue().offlineSetupError).toMatch(/offline support could not be set up/i))

    await act(async () => getPwaExperienceValue().retryOfflineSetup())

    expect(registerSW).toHaveBeenCalledTimes(2)
    expect(getPwaExperienceValue().offlineSetupError).toBeNull()
  })
})
