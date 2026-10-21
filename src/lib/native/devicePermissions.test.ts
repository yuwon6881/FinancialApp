import { afterEach, describe, expect, it } from 'vitest'
import { hasSeenPermissionSetup, markPermissionSetupSeen, readPermissionState } from './devicePermissions'

describe('device permission readings', () => {
  afterEach(() => localStorage.clear())

  it('maps every plugin state onto the four the sheet shows', () => {
    expect(readPermissionState('granted')).toBe('granted')
    expect(readPermissionState('prompt')).toBe('prompt')
    expect(readPermissionState('prompt-with-rationale')).toBe('prompt')
    expect(readPermissionState('denied')).toBe('blocked')
    expect(readPermissionState(undefined)).toBe('unavailable')
  })

  it('remembers the first showing per installation, whichever way it was closed', () => {
    expect(hasSeenPermissionSetup()).toBe(false)
    markPermissionSetupSeen('skipped')
    expect(hasSeenPermissionSetup()).toBe(true)
    localStorage.clear()
    markPermissionSetupSeen('completed')
    expect(hasSeenPermissionSetup()).toBe(true)
  })
})
