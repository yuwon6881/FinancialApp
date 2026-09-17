export class WebAuthnRequestBusyError extends Error {
  constructor() {
    super('Device verification is already in progress. Please wait or try again.')
    this.name = 'WebAuthnRequestBusyError'
  }
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('The device verification was cancelled.', 'AbortError')
  const error = new Error('The device verification was cancelled.')
  error.name = 'AbortError'
  return error
}

interface ActiveRequest {
  controller: AbortController
  rejectAbort: (error: Error) => void
  cancelled: boolean
}

let activeRequest: ActiveRequest | null = null

function abortRequest(request: ActiveRequest): void {
  if (request.cancelled) return
  request.cancelled = true
  request.controller.abort()
  // Some browsers never settle credentials.get() after abort. The old request's result is
  // ignored by Promise.race, so it must not keep the app's slot occupied indefinitely.
  releaseRequest(request)
  request.rejectAbort(createAbortError())
}

function releaseRequest(request: ActiveRequest): void {
  if (activeRequest === request) activeRequest = null
}

/**
 * Runs one WebAuthn operation at a time. The browser can keep an authenticator prompt alive after
 * the owning component has gone away, so callers must pass their lifecycle signal here. Aborting
 * rejects the caller immediately while also asking the browser to stop the underlying operation.
 */
export async function withExclusiveWebAuthnRequest<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw createAbortError()
  if (activeRequest) throw new WebAuthnRequestBusyError()

  const controller = new AbortController()
  let rejectAbort!: (error: Error) => void
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject
  })
  const request: ActiveRequest = { controller, rejectAbort, cancelled: false }
  activeRequest = request

  const onAbort = () => abortRequest(request)
  signal?.addEventListener('abort', onAbort, { once: true })

  // Invoke the browser API in the caller's stack. A user-initiated WebAuthn request must not
  // cross a lazy-import or scheduling boundary before navigator.credentials.get/create() runs,
  // otherwise Android can discard the tap's transient activation and never show its prompt.
  let operationPromise: Promise<T>
  try {
    operationPromise = Promise.resolve(operation(controller.signal))
  } catch (error) {
    operationPromise = Promise.reject(error)
  }
  // A browser implementation should honour the signal, but keep a late rejection from becoming
  // unhandled when an older implementation resolves after the caller has already moved on.
  void operationPromise.then(
    () => releaseRequest(request),
    () => releaseRequest(request),
  )

  try {
    return await Promise.race([operationPromise, abortPromise])
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

export function cancelActiveWebAuthnRequest(): void {
  if (activeRequest) abortRequest(activeRequest)
}

export function hasActiveWebAuthnRequest(): boolean {
  return activeRequest !== null
}
