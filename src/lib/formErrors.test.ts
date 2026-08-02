import { describe, it, expect, vi } from 'vitest'
import { applyServerFieldError, mapServerErrorToField, type ServerFieldRule } from './formErrors'

const RULES: ServerFieldRule<'name' | 'limit'>[] = [
  { field: 'name', match: ['already exists'], status: 409, message: 'A category with this name already exists.' },
  { field: 'limit', match: ['limit must be'] },
]

function httpError(message: string, status?: number): Error {
  const error = new Error(message) as Error & { status?: number }
  if (status !== undefined) error.status = status
  return error
}

describe('mapServerErrorToField', () => {
  it('maps a matching conflict onto its field with the rule copy', () => {
    const mapped = mapServerErrorToField(httpError('A category with this name already exists.', 409), RULES)
    expect(mapped).toEqual({ field: 'name', message: 'A category with this name already exists.' })
  })

  it('ignores a rule whose status does not match', () => {
    expect(mapServerErrorToField(httpError('A category with this name already exists.', 400), RULES)).toBeNull()
  })

  it('falls back to the raw server message when the rule has no copy', () => {
    const mapped = mapServerErrorToField(httpError('The limit must be smaller.'), RULES)
    expect(mapped).toEqual({ field: 'limit', message: 'The limit must be smaller.' })
  })

  it('matches on status alone when the rule has no substrings', () => {
    const statusOnly: ServerFieldRule<'name'>[] = [
      { field: 'name', match: [], status: 404, message: 'This category was already removed.' },
    ]
    expect(mapServerErrorToField(httpError('Failed to delete', 404), statusOnly))
      .toEqual({ field: 'name', message: 'This category was already removed.' })
    expect(mapServerErrorToField(httpError('Failed to delete', 500), statusOnly)).toBeNull()
  })

  it('never matches a rule with neither substrings nor a status', () => {
    expect(mapServerErrorToField(httpError('anything'), [{ field: 'name', match: [] }])).toBeNull()
  })

  it('returns null for transport failures so the caller can still toast', () => {
    expect(mapServerErrorToField(httpError('Failed to fetch'), RULES)).toBeNull()
    expect(mapServerErrorToField(null, RULES)).toBeNull()
  })
})

describe('applyServerFieldError', () => {
  it('reports whether the error was consumed', () => {
    const apply = vi.fn()
    expect(applyServerFieldError(httpError('already exists', 409), RULES, apply)).toBe(true)
    expect(apply).toHaveBeenCalledWith({ field: 'name', message: 'A category with this name already exists.' })

    apply.mockClear()
    expect(applyServerFieldError(httpError('Network down'), RULES, apply)).toBe(false)
    expect(apply).not.toHaveBeenCalled()
  })
})
