import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'
import { isChunkLoadError } from '../lib/chunkLoadError'

// A one-off crash (a race, a transient fetch failure): the remount renders fine,
// so "Try again" recovers and no escalation copy appears.
let shouldCrash = false
function CrashWhileFlagged() {
  if (shouldCrash) throw new Error('one-off crash')
  return <p>recovered view</p>
}

// A crash driven by something outside the subtree (stale cache, bad payload):
// remounting changes nothing, which is the case that made the button look dead.
function AlwaysCrashes(): never {
  throw new Error('persistent crash')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('remounts the subtree so a transient crash clears on Try again', () => {
    shouldCrash = true
    render(
      <ErrorBoundary variant="inline">
        <CrashWhileFlagged />
      </ErrorBoundary>
    )
    shouldCrash = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText('recovered view')).toBeTruthy()
    expect(screen.queryByText(/ran into the same problem/i)).toBeNull()
  })

  it('escalates to full recovery instructions after repeated failures', () => {
    render(
      <ErrorBoundary variant="inline">
        <AlwaysCrashes />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText(/ran into the same problem/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload app/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /clear local data/i })).toBeTruthy()
  })

  it('preserves queued changes when clearing disposable local data', () => {
    localStorage.setItem('pending_operations', JSON.stringify([{ id: 'queued-change' }]))
    render(
      <ErrorBoundary variant="screen">
        <AlwaysCrashes />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByRole('button', { name: /clear local data/i }))

    expect(JSON.parse(localStorage.getItem('pending_operations') || '[]')).toEqual([{ id: 'queued-change' }])
  })

  it('resets when resetKey changes', () => {
    shouldCrash = true
    const { rerender } = render(
      <ErrorBoundary resetKey="tab1" variant="inline">
        <CrashWhileFlagged />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    shouldCrash = false
    rerender(
      <ErrorBoundary resetKey="tab2" variant="inline">
        <CrashWhileFlagged />
      </ErrorBoundary>
    )
    expect(screen.getByText('recovered view')).toBeTruthy()
  })

  it.each([
    ['Failed to fetch dynamically imported module foo.js', true],
    ['error loading dynamically imported module: bar', true],
    ['Importing a module script failed.', true],
    ['ChunkLoadError: Loading chunk 123 failed.', true],
    ['TypeError: Failed to fetch', false],
  ])('classifies chunk load error correctly: %s', (message, expected) => {
    const error = new Error(message)
    expect(isChunkLoadError(error)).toBe(expected)
  })
})
