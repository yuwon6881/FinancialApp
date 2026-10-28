import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferTabChange, SHEET_EXIT_MS } from './sheetMotion'

describe('sheetMotion deferTabChange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not execute the tab change synchronously', () => {
    const setActiveTab = vi.fn()
    deferTabChange(setActiveTab, 'drafts')

    expect(setActiveTab).not.toHaveBeenCalled()
  })

  it('defers the tab change until SHEET_EXIT_MS has elapsed under standard motion', () => {
    const setActiveTab = vi.fn()
    deferTabChange(setActiveTab, 'drafts')

    vi.advanceTimersByTime(SHEET_EXIT_MS - 1)
    expect(setActiveTab).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(setActiveTab).toHaveBeenCalledOnce()
    expect(setActiveTab).toHaveBeenCalledWith('drafts')
  })

  it('defers the tab change with a 0 ms timer (not synchronously, but immediately on tick) when reduced motion is preferred', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList))

    const setActiveTab = vi.fn()
    deferTabChange(setActiveTab, 'drafts')

    // Must NOT execute synchronously
    expect(setActiveTab).not.toHaveBeenCalled()

    // Executes on 0 ms timer
    vi.advanceTimersByTime(0)
    expect(setActiveTab).toHaveBeenCalledOnce()
    expect(setActiveTab).toHaveBeenCalledWith('drafts')
  })
})
