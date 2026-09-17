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
}

let activeRequest: ActiveRequest | null = null

function abortRequest(request: ActiveRequest): void {
  if (!request.controller.signal.aborted) request.controller.abort()
  request.rejectAbort(createAbortError())
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
  const request: ActiveRequest = { controller, rejectAbort }
  activeRequest = request

  const onAbort = () => abortRequest(request)
  signal?.addEventListener('abort', onAbort, { once: true })

  const operationPromise = Promise.resolve().then(() => operation(controller.signal))
  // A browser implementation should honour the signal, but keep a late rejection from becoming
  // unhandled when an older implementation resolves after the caller has already moved on.
  void operationPromise.catch(() => undefined)

  try {
    return await Promise.race([operationPromise, abortPromise])
  } finally {
    signal?.removeEventListener('abort', onAbort)
    if (activeRequest === request) activeRequest = null
  }
}

export function cancelActiveWebAuthnRequest(): void {
  if (activeRequest) abortRequest(activeRequest)
}

export function hasActiveWebAuthnRequest(): boolean {
  return activeRequest !== null
}
