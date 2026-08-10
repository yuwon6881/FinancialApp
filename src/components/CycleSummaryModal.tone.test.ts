import { describe, expect, it } from 'vitest'
import { changeTone } from '../lib/cycleSummaryTone'

describe('changeTone', () => {
  // The bug this replaces: the savings-rate card's tone was an absolute threshold, so a rate that
  // fell from 40% to 20% still cleared 10% and was painted green — beside a down arrow and the
  // words "Was 40% last cycle".
  it('calls a fall a fall even when the level left behind is still healthy', () => {
    expect(changeTone(-20, true)).toBe('warn')
  })

  it('reads a rise as good where higher is better, and bad where it is not', () => {
    expect(changeTone(5, true)).toBe('good')
    expect(changeTone(5, false)).toBe('warn')
    expect(changeTone(-5, false)).toBe('good')
  })

  // Both of these used to be forced into good/warn, so an unchanged figure was coloured as a
  // verdict and drew a trend arrow for a movement that never happened.
  it('reaches no verdict on no change, or on nothing to compare against', () => {
    expect(changeTone(0, true)).toBe('neutral')
    expect(changeTone(0, false)).toBe('neutral')
    expect(changeTone(null, true)).toBe('neutral')
  })
})
