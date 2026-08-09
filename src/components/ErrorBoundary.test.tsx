
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

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
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
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

  it('says so and offers real recovery once retrying hits the same crash', () => {
    render(
      <ErrorBoundary variant="inline">
        <AlwaysCrashes />
      </ErrorBoundary>
    )
    expect(screen.queryByRole('button', { name: /reload app/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.getByText(/ran into the same problem/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload app/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /clear local data/i })).toBeTruthy()
  })

  it('surfaces the underlying error message', () => {
    render(
      <ErrorBoundary variant="inline">
        <AlwaysCrashes />
      </ErrorBoundary>
    )
    expect(screen.getByText('persistent crash')).toBeTruthy()
  })
})
