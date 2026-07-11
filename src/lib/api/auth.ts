import type { AssertionOptionsJson, CreateOptionsJson } from '../webauthn'
import type { LoginCredentials, RegisterCredentials } from '../apiTypes'
import { apiFetch, invalidateCache, jsonBody, request, requestVoid } from './client'

export function getDeviceInfo(): { deviceId: string; deviceName: string } {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('deviceId', deviceId)
  }

  const userAgent = navigator.userAgent
  let browser = 'Unknown Browser'
  let os = 'Unknown OS'
  if (userAgent.includes('Firefox/')) browser = 'Firefox'
  else if (userAgent.includes('Edg/')) browser = 'Edge'
  else if (userAgent.includes('Chrome/')) browser = 'Chrome'
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) browser = 'Safari'

  if (userAgent.includes('Windows NT')) os = 'Windows'
  else if (userAgent.includes('Mac OS X')) os = 'macOS'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iPhone')) os = 'iOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  return { deviceId, deviceName: `${browser} on ${os}` }
}

export async function fetchAuthStatus(): Promise<{ isRegistered: boolean; hasFingerprint: boolean }> {
  return request('/auth/status', {
    authenticated: false,
    errorMessage: 'Failed to fetch auth status',
  })
}

export type LoginResult =
  | { token: string; username: string }
  | { requiresTwoFactor: true; pendingToken: string }

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const data = await request<LoginResult>('/auth/login', {
    method: 'POST',
    ...jsonBody({ ...credentials, ...getDeviceInfo() }),
    authenticated: false,
    errorMessage: 'Invalid credentials',
  })
  if (!('requiresTwoFactor' in data)) {
    localStorage.setItem('auth_token', data.token)
    invalidateCache()
  }
  return data
}

export async function verifyTwoFactorLogin(pendingToken: string, code: string): Promise<{ token: string; username: string }> {
  const data = await request<{ token: string; username: string }>('/auth/login/2fa', {
    method: 'POST',
    ...jsonBody({ pendingToken, code }),
    authenticated: false,
    errorMessage: 'Invalid code',
  })
  localStorage.setItem('auth_token', data.token)
  invalidateCache()
  return data
}

export async function register(credentials: RegisterCredentials): Promise<void> {
  await requestVoid('/auth/register', {
    method: 'POST',
    ...jsonBody(credentials),
    authenticated: false,
    errorMessage: 'Registration failed',
  })
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } catch (error) {
    console.error('Logout request failed', error)
  } finally {
    localStorage.removeItem('auth_token')
    invalidateCache()
  }
}

export async function verifyPassword(password: string): Promise<{ verified: boolean; message?: string }> {
  const data = await request<{ verified: boolean; message?: string }>('/auth/verify-password', {
    method: 'POST',
    ...jsonBody({ password }),
    errorMessage: 'Password verification request failed',
  })
  if (data.verified) invalidateCache()
  return data
}

export async function lockSession(): Promise<void> {
  const response = await apiFetch('/auth/lock', { method: 'POST' })
  if (!response.ok) console.warn('Failed to lock session on server')
  else invalidateCache()
}

export interface FingerprintCredentialSummary {
  id: string
  deviceLabel: string | null
  createdAt: string
}

export interface SessionSummary {
  id: string
  deviceName: string
  createdAt: string
  expiresAt: string
  isLocked: boolean
  lastActiveAt: string | null
  ipAddress: string | null
  userAgent: string | null
  isCurrent: boolean
}

export interface TwoFactorStatus {
  enabled: boolean
}

export async function getFingerprintRegisterOptions(): Promise<{ challengeId: string; options: CreateOptionsJson }> {
  return request('/auth/webauthn/register/options', {
    method: 'POST',
    errorMessage: 'Failed to start fingerprint registration',
  })
}

export async function verifyFingerprintRegistration(challengeId: string, credential: unknown, deviceLabel?: string): Promise<void> {
  await requestVoid('/auth/webauthn/register/verify', {
    method: 'POST',
    ...jsonBody({ challengeId, credential, deviceLabel }),
    errorMessage: 'Failed to register fingerprint',
  })
}

export async function listFingerprintCredentials(): Promise<FingerprintCredentialSummary[]> {
  return request('/auth/webauthn/credentials', {
    errorMessage: 'Failed to load fingerprint credentials',
  })
}

export async function deleteFingerprintCredential(id: string): Promise<void> {
  await requestVoid(`/auth/webauthn/credentials/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to remove fingerprint credential',
  })
}

export async function getFingerprintLoginOptions(): Promise<{ challengeId: string; options: AssertionOptionsJson }> {
  return request('/auth/webauthn/login/options', {
    method: 'POST',
    authenticated: false,
    errorMessage: 'Fingerprint login is not available',
  })
}

export async function verifyFingerprintLogin(challengeId: string, credential: unknown): Promise<{ token: string; username: string }> {
  const data = await request<{ token: string; username: string }>('/auth/webauthn/login/verify', {
    method: 'POST',
    ...jsonBody({ challengeId, credential, ...getDeviceInfo() }),
    authenticated: false,
    errorMessage: 'Verification failed',
  })
  localStorage.setItem('auth_token', data.token)
  invalidateCache()
  return data
}

export async function getSessions(): Promise<SessionSummary[]> {
  return request('/auth/sessions', { errorMessage: 'Failed to fetch sessions' })
}

export async function revokeSession(id: string): Promise<void> {
  await requestVoid(`/auth/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    errorMessage: 'Failed to revoke session',
  })
}

export async function revokeAllSessions(keepCurrent = true): Promise<{ revokedCount: number }> {
  return request(`/auth/sessions/revoke-all?keepCurrent=${keepCurrent}`, {
    method: 'POST',
    errorMessage: 'Failed to log out other devices',
  })
}

export async function sendSessionHeartbeat(): Promise<void> {
  try {
    await apiFetch('/auth/sessions/heartbeat', { method: 'POST' })
  } catch {
    // Best-effort: the client-side inactivity timer does not depend on this succeeding.
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await requestVoid('/auth/change-password', {
    method: 'POST',
    ...jsonBody({ currentPassword, newPassword }),
    errorMessage: 'Failed to change password',
  })
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return request('/auth/2fa/status', { errorMessage: 'Failed to load two-factor status' })
}

export async function setupTotp(): Promise<{ secret: string; otpauthUri: string }> {
  return request('/auth/2fa/totp/setup', {
    method: 'POST',
    errorMessage: 'Failed to start two-factor setup',
  })
}

export async function enableTotp(code: string): Promise<{ enabled: boolean; recoveryCodes: string[] }> {
  return request('/auth/2fa/totp/enable', {
    method: 'POST',
    ...jsonBody({ code }),
    errorMessage: 'Invalid code',
  })
}

export async function disableTotp(password: string, code: string): Promise<void> {
  await requestVoid('/auth/2fa/totp/disable', {
    method: 'POST',
    ...jsonBody({ password, code }),
    errorMessage: 'Failed to disable two-factor authentication',
  })
}

export async function regenerateRecoveryCodes(password: string): Promise<{ recoveryCodes: string[] }> {
  return request('/auth/2fa/recovery-codes/regenerate', {
    method: 'POST',
    ...jsonBody({ password }),
    errorMessage: 'Failed to regenerate recovery codes',
  })
}

export async function getFingerprintAssertOptions(): Promise<{ challengeId: string; options: AssertionOptionsJson }> {
  return request('/auth/webauthn/assert/options', {
    method: 'POST',
    errorMessage: 'Fingerprint verification is not available',
  })
}

export async function verifyFingerprintAssert(challengeId: string, credential: unknown): Promise<{ verified: boolean }> {
  return request('/auth/webauthn/assert/verify', {
    method: 'POST',
    ...jsonBody({ challengeId, credential }),
    errorMessage: 'Fingerprint verification failed',
  })
}
