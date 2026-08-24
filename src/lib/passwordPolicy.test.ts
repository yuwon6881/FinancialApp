import { describe, expect, it } from 'vitest'
import { getNewPasswordError, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './passwordPolicy'

describe('new password policy', () => {
  it('enforces the same bounded length used by the API', () => {
    expect(getNewPasswordError('x'.repeat(MIN_PASSWORD_LENGTH - 1))).toContain(`at least ${MIN_PASSWORD_LENGTH}`)
    expect(getNewPasswordError('x'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
    expect(getNewPasswordError('x'.repeat(MAX_PASSWORD_LENGTH + 1))).toContain('or fewer')
  })
})
