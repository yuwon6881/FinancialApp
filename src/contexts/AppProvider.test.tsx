/* eslint-disable react-hooks/immutability, react-hooks/globals --
   Counting renders means mutating state from render, which these rules correctly flag as
   impure. It is intentional and confined to this file: the counters are the measurement.
   Keeping the components impure also stops the React Compiler from memoizing them, which
   is what makes the counts reflect actual renders. */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { AppProvider } from './AppProvider'
import { useAppPrefs, useAppSync, useAppUi, type AppContextValue } from './AppContext'

afterEach(cleanup)

const baseValue: AppContextValue = {
  hideSensitive: false,
  currency: 'MYR',
  darkMode: false,
  formatSensitive: (v: number) => String(v),
  showToast: () => undefined,
  guardSensitive: () => true,
  confirm: () => undefined,
  activeSyncId: null,
  deletingId: null,
  isSyncing: false,
  isOffline: false,
  operations: [],
  queueMutation: () => undefined,
}

// These tests are the point of the three-context split: they fail if the slices are
// re-merged, or if AppProvider's useMemo dependency lists are widened to `value`.
//
// The children element is created ONCE and reused across rerenders. That is deliberate:
// with a fresh element tree each render, React re-renders the consumers no matter what the
// context did, and the test would pass whether or not the split works. A stable element is
// what isolates "did the context force this render?" — and it also mirrors production,
// where the React Compiler caches these elements when their props have not changed.
const counts = { prefs: 0, ui: 0, sync: 0 }
const PrefsConsumer = () => { useAppPrefs(); counts.prefs++; return null }
const UiConsumer = () => { useAppUi(); counts.ui++; return null }
const SyncConsumer = () => { useAppSync(); counts.sync++; return null }
const consumers = (
  <>
    <PrefsConsumer />
    <UiConsumer />
    <SyncConsumer />
  </>
)

function renderWith(value: AppContextValue) {
  counts.prefs = 0
  counts.ui = 0
  counts.sync = 0
  const utils = render(<AppProvider value={value}>{consumers}</AppProvider>)
  const rerenderWith = (next: AppContextValue) =>
    utils.rerender(<AppProvider value={next}>{consumers}</AppProvider>)
  return { ...utils, rerenderWith }
}

describe('AppProvider slice isolation', () => {
  it('does not re-render prefs or UI consumers when only sync state changes', () => {
    const { rerenderWith } = renderWith(baseValue)
    const before = { ...counts }

    // An outbox tick: sync fields change, everything else keeps its identity.
    rerenderWith({ ...baseValue, isSyncing: true, activeSyncId: 'tx-1' })

    expect(counts.prefs).toBe(before.prefs)
    expect(counts.ui).toBe(before.ui)
    expect(counts.sync).toBe(before.sync + 1)
  })

  it('re-renders prefs consumers when a preference changes, but not sync consumers', () => {
    const { rerenderWith } = renderWith(baseValue)
    const before = { ...counts }

    rerenderWith({ ...baseValue, currency: 'USD' })

    expect(counts.prefs).toBe(before.prefs + 1)
    expect(counts.sync).toBe(before.sync)
    expect(counts.ui).toBe(before.ui)
  })

  it('exposes the current values through each slice', () => {
    let seen: { currency?: string; isSyncing?: boolean } = {}
    const Probe = () => {
      const { currency } = useAppPrefs()
      const { isSyncing } = useAppSync()
      seen = { currency, isSyncing }
      return null
    }
    render(
      <AppProvider value={{ ...baseValue, currency: 'SGD', isSyncing: true }}>
        <Probe />
      </AppProvider>,
    )
    expect(seen).toEqual({ currency: 'SGD', isSyncing: true })
  })
})
