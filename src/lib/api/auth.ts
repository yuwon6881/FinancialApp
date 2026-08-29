import type { AssertionOptionsJson, CreateOptionsJson } from '../webauthn'
import type { LoginCredentials, RegisterCredentials } from '../apiTypes'
import type { QuestionAnswerDto, SecurityQuestionsRecoveryStartResponse } from '../../types'
import { apiFetch, invalidateCache, jsonBody, noteSessionUnlocked, request, requestVoid } from './client'
import { tokenStore } from '../auth'
import { getDeviceUnlockRegistrationMarker } from '../deviceUnlockRegistration'

function getDeviceInfo(): { deviceId: string; deviceName: string } {
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

export interface AuthStatus {
  isRegistered: boolean
  hasFingerprint: boolean
  hasFingerprintOnDevice: boolean
  registrationOpen: boolean
}

export async function fetchAuthStatus(username?: string): Promise<AuthStatus> {
  const params = new URLSearchParams()
  if (username) {
    params.set('username', username)
    const deviceCredentialId = getDeviceUnlockRegistrationMarker(username)
    if (deviceCredentialId) params.set('deviceCredentialId', deviceCredentialId)
  }
  const query = params.toString()
  const url = query ? `/auth/status?${query}` : '/auth/status'
  return request(url, {
    authenticated: false,
    errorMessage: 'Failed to fetch auth status',
  })
}

export type AuthenticatedLoginResult = {
  token: string
  username: string
  hasSetupSecurityQuestions: boolean
}

export type LoginResult =
  | AuthenticatedLoginResult
  | { requiresTwoFactor: true; pendingToken: string }

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const data = await request<LoginResult>('/auth/login', {
    method: 'POST',
    ...jsonBody({ ...credentials, ...getDeviceInfo() }),
    authenticated: false,
    errorMessage: 'Invalid credentials',
  })
  if (!('requiresTwoFactor' in data)) {
    await tokenStore.setToken(data.token)
    invalidateCache()
  }
  return data
}

export async function verifyTwoFactorLogin(pendingToken: string, code: string): Promise<AuthenticatedLoginResult> {
  const data = await request<AuthenticatedLoginResult>('/auth/login/2fa', {
    method: 'POST',
    ...jsonBody({ pendingToken, code }),
    authenticated: false,
    errorMessage: 'Invalid code',
  })
  await tokenStore.setToken(data.token)
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
    try {
      await tokenStore.clearToken()
    } catch (error) {
      console.error('Could not clear the local authentication token.', error)
    }
    try {
      sessionStorage.removeItem('csrf_token')
    } catch (error) {
      console.warn('Could not clear the cached CSRF token.', error)
    }
    invalidateCache()
  }
}

/**
 * The inactivity lock and an unlock are two writes to the same session row, and the browser gives
 * no ordering guarantee between two requests in flight. A lock issued as the page opens (the idle
 * check runs on the very first tick) could land *after* the unlock it raced, leaving the session
 * locked on the server even though the password was accepted -- the user's first unlock silently
 * did nothing and only the second, with no lock in flight, worked. Unlocks therefore wait for any
 * lock still in flight, so the unlock is always the last write.
 */
let lockSessionAbortController: AbortController | null = null
let pendingSessionLock: Promise<unknown> | null = null

async function afterPendingSessionLock(): Promise<void> {
  const pending = pendingSessionLock
  if (!pending) return
  await pending.catch(() => undefined)
}

export async function verifyPassword(password: string): Promise<{ verified: boolean; message?: string }> {
  lockSessionAbortController?.abort()
  await afterPendingSessionLock()
  const data = await request<{ verified: boolean; message?: string }>('/auth/verify-password', {
    method: 'POST',
    ...jsonBody({ password }),
    errorMessage: 'Password verification request failed',
  })
  if (data.verified) {
    noteSessionUnlocked()
    invalidateCache()
  }
  return data
}

export async function lockSession(): Promise<void> {
  lockSessionAbortController?.abort()
  const ac = new AbortController()
  lockSessionAbortController = ac
  const lock = apiFetch('/auth/lock', { method: 'POST', signal: ac.signal })
  pendingSessionLock = lock
  try {
    const response = await lock
    if (!response.ok) console.warn('Failed to lock session on server')
    else invalidateCache()
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return
    console.warn('Failed to lock session on server', err)
  } finally {
    if (pendingSessionLock === lock) pendingSessionLock = null
    if (lockSessionAbortController === ac) lockSessionAbortController = null
  }
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
    errorMessage: 'Failed to start device unlock setup',
  })
}

export async function verifyFingerprintRegistration(challengeId: string, credential: unknown, deviceLabel?: string): Promise<void> {
  await requestVoid('/auth/webauthn/register/verify', {
    method: 'POST',
    ...jsonBody({ challengeId, credential, deviceLabel }),
    errorMessage: 'Failed to set up device unlock',
  })
}

export async function listFingerprintCredentials(): Promise<FingerprintCredentialSummary[]> {
  return request('/auth/webauthn/credentials', {
    errorMessage: 'Failed to load device unlock credentials',
  })
}

export async function deleteFingerprintCredential(id: string): Promise<void> {
  await requestVoid(`/auth/webauthn/credentials/${id}`, {
    method: 'DELETE',
    errorMessage: 'Failed to remove device unlock credential',
  })
}

export async function getFingerprintLoginOptions(username?: string): Promise<{ challengeId: string; options: AssertionOptionsJson }> {
  const url = username ? `/auth/webauthn/login/options?username=${encodeURIComponent(username)}` : '/auth/webauthn/login/options'
  return request(url, {
    method: 'POST',
    authenticated: false,
    errorMessage: 'Device unlock is not available',
  })
}

export async function verifyFingerprintLogin(challengeId: string, credential: unknown): Promise<{ token: string; username: string; hasSetupSecurityQuestions?: boolean }> {
  const data = await request<{ token: string; username: string; hasSetupSecurityQuestions?: boolean }>('/auth/webauthn/login/verify', {
    method: 'POST',
    ...jsonBody({ challengeId, credential, ...getDeviceInfo() }),
    authenticated: false,
    errorMessage: 'Verification failed',
  })
  await tokenStore.setToken(data.token)
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
    errorMessage: 'Device verification is not available',
  })
}

export async function verifyFingerprintAssert(challengeId: string, credential: unknown): Promise<{ verified: boolean }> {
  lockSessionAbortController?.abort()
  await afterPendingSessionLock()
  const data = await request<{ verified: boolean }>('/auth/webauthn/assert/verify', {
    method: 'POST',
    ...jsonBody({ challengeId, credential }),
    errorMessage: 'Device verification failed',
  })
  if (data.verified) noteSessionUnlocked()
  return data
}

export async function getAvailableSecurityQuestions(): Promise<string[]> {
  return request('/auth/security-questions/available', { authenticated: false, errorMessage: 'Failed to load security questions' })
}

export async function setupSecurityQuestions(answers: QuestionAnswerDto[]): Promise<void> {
  await requestVoid('/auth/security-questions/setup', {
    method: 'POST',
    ...jsonBody({ answers }),
    errorMessage: 'Failed to set up security questions',
  })
}

export async function startSecurityQuestionsRecovery(username: string): Promise<SecurityQuestionsRecoveryStartResponse> {
  return request('/auth/security-questions/recovery/start', {
    method: 'POST',
    authenticated: false,
    ...jsonBody({ username }),
    errorMessage: 'Failed to start recovery',
  })
}

export async function resetPasswordViaSecurityQuestions(username: string, answers: QuestionAnswerDto[], newPassword: string): Promise<void> {
  await requestVoid('/auth/security-questions/recovery/reset', {
    method: 'POST',
    authenticated: false,
    ...jsonBody({ username, answers, newPassword }),
    errorMessage: 'Failed to reset password',
  })
}
